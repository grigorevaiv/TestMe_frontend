import { Component, effect, inject } from '@angular/core';
import { ResourceService } from '../../services/resource.service';
import { Interpretation, Scale } from '../../interfaces/test.interface';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TestService } from '../../services/test.service';
import { stepRoutes } from '../../constants/step-routes';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { first, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-test-interpretations',
  standalone: true,
  imports: [ReactiveFormsModule, ProgressBarComponent],
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
  constructor() {
    effect(() => {
      this.testId = this.resourceService.testResource.value()?.id ?? null;
      const scales = this.resourceService.scalesResource.value();
      if (scales) {
        console.log('Scales received:', scales);
        this.scales = scales;
        this.initializeInterpretationForms(scales);
      } else {
        console.log('No scales found for testId:', this.testId);
      }
      const interpretations = this.resourceService.interpretationsResource.value();
      if (interpretations) {
        console.log('Interpretations received:', interpretations);
        this.testInterpretations = interpretations;
        this.patchInterpretationsToForm(interpretations);
      }
      else {
        console.log('No interpretations found for testId:', this.testId);
      }

      this.testState = this.resourceService.testResource.value()?.state ?? null;
      console.log('Test state:', this.testState);
      
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

onSave() {
  this.cleanExtraInterpretations();
  const allData = Object.entries(this.interpretationsPerScale).flatMap(([scaleId, formArray]) => {
    const selected = this.selectedLevels[+scaleId];

    return formArray.controls
      .filter(ctrl => ctrl.get('level')?.value <= selected)
      .map(ctrl => ctrl.value);
  });

  console.log('Submitting only active data:', allData);
  // change for first value from
  if(!this.testInterpretations || this.testInterpretations.length === 0) {
    this.testService.saveInterpretationsBatch(allData).subscribe({
      next: (interpretations) => {
        console.log('Interpretations saved successfully:', interpretations);
      }
      , error: (error) => {
        console.error('Error saving interpretations:', error);
      }
    });

    if(this.testState && this.testState.currentStep < 8) {
      this.testState.currentStep = 8;
      this.testState.state = 'active';
      this.testService.updateTestStateStep(this.testId!, this.testState).subscribe({
        next: (state) => {
          console.log('Test state updated successfully:', state);
        },
        error: (error) => {
          console.error('Error updating test state:', error);
        }
      });
    }
  }
  else {
    console.error('No interpretations to save or testInterpretations is empty');
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
