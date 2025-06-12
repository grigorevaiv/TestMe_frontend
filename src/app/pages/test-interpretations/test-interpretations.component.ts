import { Component, effect, inject } from '@angular/core';
import { ResourceService } from '../../services/resource.service';
import { Interpretation, Scale } from '../../interfaces/test.interface';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TestService } from '../../services/test.service';
import { stepRoutes } from '../../constants/step-routes';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { first, firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-test-interpretations',
  standalone: true,
  imports: [ReactiveFormsModule, ProgressBarComponent, NgIf],
  templateUrl: './test-interpretations.component.html',
  styleUrls: ['./test-interpretations.component.css']
})
export class TestInterpretationsComponent {
  fb = inject(FormBuilder);
  resourceService = inject(ResourceService);
  testService = inject(TestService);
  testId: number | null = null;
  testState: any = null;
  scales: Scale[] = [];
  testInterpretations: Interpretation[] = [];
  step=8;
  router = inject(Router);
  route = inject(ActivatedRoute);
  sessionStorage = inject(SessionStorageService);
  mode: string = '';
  testContextService = inject(TestContextService);

async ngOnInit(): Promise<void> {
  const idParam = this.route.snapshot.paramMap.get('testId');
  const mode = this.route.snapshot.paramMap.get('mode') || 'new';
  const storedId = this.sessionStorage.getTestId();
  const id = idParam ? Number(idParam) : storedId;

  if (!id) {
    console.warn('[TestInterpretationsComponent] No test ID found');
    return;
  }

  this.testId = id;
  this.mode = mode;
  this.sessionStorage.setTestId(id);

  await firstValueFrom(this.testContextService.ensureContext(this.testId, this.mode));

  this.testContextService.getTest().subscribe(test => {
    this.testState = test?.state ?? null;
    this.testId = test?.id ?? this.testId;
  });

  this.testContextService.getScales().subscribe(scales => {
    if (scales) {
      console.log('Scales received:', scales);
      this.scales = scales;
      this.initializeInterpretationForms(scales);
    }
  });

  this.testContextService.getInterpretations().subscribe(interpretations => {
    if (interpretations) {
      console.log('Interpretations received:', interpretations);
      this.testInterpretations = interpretations;
      this.patchInterpretationsToForm(interpretations);
    } else {
      console.log('No interpretations found for testId:', this.testId);
    }
  });
}




  interpretationsPerScale: {[scaleId: number]: FormArray<FormGroup>} = {};

  interForm = this.fb.group({
    interpretations: this.fb.array<FormGroup>([])
  });

  get interpretations(): FormArray<FormGroup> {
    return this.interForm.get('interpretations') as FormArray<FormGroup>;
  }

initializeInterpretationForms(scales: Scale[]) {
  this.interpretationsPerScale = {};
  this.selectedLevels = {};

  for (const scale of scales) {
    const formArray = this.fb.array<FormGroup>([]);

    // создаём только первую (уровень 1)
    formArray.push(this.fb.group({
      id: [null],
      scaleId: [scale.id],
      level: [1],
      text: ['']
    }));

    this.interpretationsPerScale[scale.id!] = formArray;
    this.selectedLevels[scale.id!] = 1; // отрисуем только первую
  }
}


selectedLevels: { [scaleId: number]: number } = {};


onRadioLevelChange(scaleId: number, levelCount: number) {
  const formArray = this.interpretationsPerScale[scaleId];
  if (!formArray) return;

  const currentLength = formArray.length;

  // Добавляем недостающие уровни, если нужно
  for (let level = currentLength + 1; level <= levelCount; level++) {
    formArray.push(this.fb.group({
      scaleId: [scaleId],
      level: [level],
      text: ['']
    }));
  }

  // Просто запоминаем, сколько показывать
  this.selectedLevels[scaleId] = levelCount;
}

isScaleValid(scaleId: number): boolean {
  const selected = this.selectedLevels[scaleId];
  const formArray = this.interpretationsPerScale[scaleId];
  if (!formArray) return false;

  // Должно быть хотя бы selected интерпретаций
  if (formArray.length < selected) return false;

  // Проверяем, что в пределах выбранного количества текст заполнен
  for (let i = 0; i < selected; i++) {
    const ctrl = formArray.at(i).get('text');
    if (!ctrl?.value?.trim()) return false;
  }

  return true;
}

cleanExtraInterpretations() {
  for (const scaleId in this.interpretationsPerScale) {
    const formArray = this.interpretationsPerScale[scaleId];
    const selected = this.selectedLevels[scaleId];

    for (let i = selected; i < formArray.length; i++) {
      formArray.at(i).get('text')?.reset('');
    }
  }
}

  async onSave(): Promise<void> {
    this.cleanExtraInterpretations();

    const allData = Object.entries(this.interpretationsPerScale).flatMap(([scaleId, formArray]) => {
      const selected = this.selectedLevels[+scaleId];
      return formArray.controls
        .filter(ctrl => ctrl.get('level')?.value <= selected)
        .map(ctrl => ctrl.value);
    });

    console.log('📤 Submitting only active data:', allData);

    if (!this.testInterpretations || this.testInterpretations.length === 0) {
      try {
        const saved = await firstValueFrom(this.testService.saveInterpretationsBatch(allData));
        console.log('Interpretations saved successfully:', saved);

        if (this.testState && this.testState.currentStep < 8) {
          this.testState.currentStep = 8;
          this.testState.state = 'active';

          const updatedState = await firstValueFrom(
            this.testService.updateTestStateStep(this.testId!, this.testState)
          );
          console.log('Test state updated successfully:', updatedState);

          await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId!, 'edit', true));
          this.router.navigate(['/test-interpretations/edit', this.testId]);
        }
      } catch (error) {
        console.error('Error saving interpretations or updating test state:', error);
        this.toast?.show?.({ message: 'Failed to save interpretations', type: 'error' });
      }
    } else {
      console.warn('Interpretations already exist, skipping save');
    }
  }


onUpdate() {
    this.cleanExtraInterpretations();
    const updatedData = Object.entries(this.interpretationsPerScale).flatMap(([scaleId, formArray]) => {
    const selected = this.selectedLevels[+scaleId];

    return formArray.controls
      .map(ctrl => ctrl.value);
  });
  console.log('Updating interpretations with data:', updatedData);
  this.testService.updateInterpretationsBatch(updatedData).subscribe({
    next: (interpretations) => {
      console.log('Interpretations updated successfully:', interpretations);
    },
    error: (error) => {
      console.error('Error updating interpretations:', error);
    }
  });
}

allScalesValid(): boolean {
  return this.scales.every(scale => this.isScaleValid(scale.id!));
}

patchInterpretationsToForm(incoming: Interpretation[]) {
  const groupedByScale: { [scaleId: number]: Interpretation[] } = {};

  // Группируем по scaleId
  for (const item of incoming) {
    if (!groupedByScale[item.scaleId]) {
      groupedByScale[item.scaleId] = [];
    }
    groupedByScale[item.scaleId].push(item);
  }

  // Обрабатываем каждую шкалу
  for (const scaleIdStr in groupedByScale) {
    const scaleId = +scaleIdStr;
    const interpretations = groupedByScale[scaleId];

    // Убедимся, что у нас есть FormArray для этой шкалы
    if (!this.interpretationsPerScale[scaleId]) {
      this.interpretationsPerScale[scaleId] = this.fb.array<FormGroup>([]);
    }

    const formArray = this.interpretationsPerScale[scaleId];
    formArray.clear(); // обнулим старые формы, если были

    // Заполняем формы
    interpretations.forEach((interp) => {
      formArray.push(
        this.fb.group({
          id: [interp.id],
          scaleId: [interp.scaleId],
          level: [interp.level],
          text: [interp.text]
        })
      );
    });

    // Обновляем количество выбранных уровней
    this.selectedLevels[scaleId] = interpretations.length;
  }
}
  get completedStepsArray(): number[] {
    const currentStep = this.testState?.currentStep ?? 0;
    return Array.from({ length: currentStep }, (_, i) => i + 1);
  }

onStepSelected(step: number) {
  console.log('[onStepSelected] Called with step:', step);
  console.log('[onStepSelected] Current testId:', this.testId);
  if (!this.testId || !stepRoutes[step]) return;
  this.router.navigate(stepRoutes[step](this.testId));
}
toast = inject(ToastService);
  async changeStatus() {
    if (!this.testId || !this.testState) return;

    this.testState.currentStep = this.step;
    this.testState.state = 'active';
    const savedState = await firstValueFrom (this.testService.updateTestStateStep(this.testId, this.testState));
    if (savedState) {
      this.toast.show({message: 'Test saved successfully', type: 'success'});
      this.router.navigate(['/']);
    } else {
      this.toast.show({message: 'Error updating test state', type: 'error'});
    }
  }

}
