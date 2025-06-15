import {
  Component,
  effect,
  ElementRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { ResourceService } from '../../services/resource.service';
import { Interpretation, Scale } from '../../interfaces/test.interface';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { TestService } from '../../services/test.service';
import { stepRoutes } from '../../constants/step-routes';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { first, firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { NgIf } from '@angular/common';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { StepRedirectService } from '../../services/step-redirect.service';

@Component({
  selector: 'app-test-interpretations',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ProgressBarComponent,
    NgIf,
    ConfirmDialogComponent,
  ],
  templateUrl: './test-interpretations.component.html',
  styleUrls: ['./test-interpretations.component.css'],
})
export class TestInterpretationsComponent {
  fb = inject(FormBuilder);
  resourceService = inject(ResourceService);
  testService = inject(TestService);
  testId: number | null = null;
  testState: any = null;
  scales: Scale[] = [];
  testInterpretations: Interpretation[] = [];
  step = 8;
  router = inject(Router);
  route = inject(ActivatedRoute);
  sessionStorage = inject(SessionStorageService);
  mode: string = '';
  testContextService = inject(TestContextService);
  stepRedirectService = inject(StepRedirectService);

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('testId');
    const mode = this.route.snapshot.paramMap.get('mode') || 'new';
    const storedId = this.sessionStorage.getTestId();
    const id = idParam ? Number(idParam) : storedId;

    if (id) {
      const redirected =
        await this.stepRedirectService.redirectIfStepAlreadyCompleted(
          mode,
          id,
          8,
          (id) => ['/test-interpretations/edit', id]
        );
      if (redirected) return;
    }
    if (!id) {
      console.warn('[TestInterpretationsComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.sessionStorage.setTestId(id);

    await firstValueFrom(
      this.testContextService.ensureContext(this.testId, this.mode, 8)
    );

    this.testContextService.getTest().subscribe((test) => {
      this.testState = test?.state ?? null;
      this.testId = test?.id ?? this.testId;
    });

    this.testContextService.getScales().subscribe((scales) => {
      if (scales) {
        console.log('Scales received:', scales);
        this.scales = scales;
        this.initializeInterpretationForms(scales);
      }
    });

    this.testContextService
      .getInterpretations()
      .subscribe((interpretations) => {
        if (interpretations) {
          console.log('Interpretations received:', interpretations);
          this.testInterpretations = interpretations;
          this.patchInterpretationsToForm(interpretations);
        } else {
          console.log('No interpretations found for testId:', this.testId);
        }
      });
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  interpretationsPerScale: { [scaleId: number]: FormArray<FormGroup> } = {};

  interForm = this.fb.group({
    interpretations: this.fb.array<FormGroup>([]),
  });

  get interpretations(): FormArray<FormGroup> {
    return this.interForm.get('interpretations') as FormArray<FormGroup>;
  }

  initializeInterpretationForms(scales: Scale[]) {
    this.interpretationsPerScale = {};
    this.selectedLevels = {};

    for (const scale of scales) {
      const formArray = this.fb.array<FormGroup>([]);
      formArray.push(
        this.fb.group({
          id: [null],
          scaleId: [scale.id],
          level: [1],
          text: [''],
        })
      );

      this.interpretationsPerScale[scale.id!] = formArray;
      this.selectedLevels[scale.id!] = 1;
    }
  }

  selectedLevels: { [scaleId: number]: number } = {};

  onRadioLevelChange(scaleId: number, levelCount: number) {
    const formArray = this.interpretationsPerScale[scaleId];
    if (!formArray) return;

    const currentLength = formArray.length;
    for (let level = currentLength + 1; level <= levelCount; level++) {
      formArray.push(
        this.fb.group({
          scaleId: [scaleId],
          level: [level],
          text: [''],
        })
      );
    }
    this.selectedLevels[scaleId] = levelCount;
  }

  isScaleValid(scaleId: number): boolean {
    const selected = this.selectedLevels[scaleId];
    const formArray = this.interpretationsPerScale[scaleId];
    if (!formArray) return false;

    if (formArray.length < selected) return false;

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
    if (!this.allScalesValid()) {
      this.toast.show?.({
        message: 'Please complete all interpretations before saving',
        type: 'error',
      });

      const firstInvalidIndex = this.scales.findIndex(
        (scale) => !this.isScaleValid(scale.id!)
      );
      const element =
        this.interpretationCards?.get(firstInvalidIndex)?.nativeElement;

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-red-400');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-red-400');
        }, 2000);
      }

      return;
    }

    this.cleanExtraInterpretations();

    const allData = Object.entries(this.interpretationsPerScale).flatMap(
      ([scaleId, formArray]) => {
        const selected = this.selectedLevels[+scaleId];
        return formArray.controls
          .filter((ctrl) => ctrl.get('level')?.value <= selected)
          .map((ctrl) => ctrl.value);
      }
    );

    console.log('Saving interpretation data:', allData);

    try {
      if (!this.testInterpretations || this.testInterpretations.length === 0) {
        const saved = await firstValueFrom(
          this.testService.saveInterpretationsBatch(allData)
        );
        console.log('Interpretations saved successfully:', saved);
        if (this.mode === 'new') {
          this.testState.currentStep = this.step;
          this.testState.state = 'active';

          const updatedState = await firstValueFrom(
            this.testService.updateTestStateStep(this.testId!, this.testState)
          );

          console.log('Test state updated:', updatedState);

          await firstValueFrom(
            this.testContextService.loadContextIfNeeded(
              this.testId!,
              'edit',
              8,
              true
            )
          );
          this.toast.show?.({
            message: 'Interpretations saved successfully',
            type: 'success',
          });
          this.router.navigate(['/test-interpretations/edit', this.testId]);
          this.markAllAsPristine();
        } else {
          this.toast.show?.({
            message: 'Interpretations saved successfully',
            type: 'success',
          });
        }
      } else {
        const updated = await firstValueFrom(
          this.testService.updateInterpretationsBatch(allData)
        );
        console.log('Interpretations updated successfully:', updated);
        this.markAllAsPristine();
        this.toast.show?.({
          message: 'Interpretations updated successfully',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error during interpretation save/update:', error);
      this.toast.show?.({
        message: 'Error saving interpretations',
        type: 'error',
      });
    }
  }

  allScalesValid(): boolean {
    return this.scales.every((scale) => this.isScaleValid(scale.id!));
  }

  patchInterpretationsToForm(incoming: Interpretation[]) {
    const groupedByScale: { [scaleId: number]: Interpretation[] } = {};
    for (const item of incoming) {
      if (!groupedByScale[item.scaleId]) {
        groupedByScale[item.scaleId] = [];
      }
      groupedByScale[item.scaleId].push(item);
    }
    for (const scaleIdStr in groupedByScale) {
      const scaleId = +scaleIdStr;
      const interpretations = groupedByScale[scaleId];

      if (!this.interpretationsPerScale[scaleId]) {
        this.interpretationsPerScale[scaleId] = this.fb.array<FormGroup>([]);
      }

      const formArray = this.interpretationsPerScale[scaleId];
      formArray.clear();

      interpretations.forEach((interp) => {
        formArray.push(
          this.fb.group({
            id: [interp.id],
            scaleId: [interp.scaleId],
            level: [interp.level],
            text: [interp.text],
          })
        );
      });

      this.selectedLevels[scaleId] = interpretations.length;
    }
  }
  get completedStepsArray(): number[] {
    const currentStep = this.testState?.currentStep ?? 0;
    return Array.from({ length: currentStep }, (_, i) => i + 1);
  }

  toast = inject(ToastService);

  async changeStatus(): Promise<void> {
    if (!this.testId || !this.testState) return;

    if (!this.allScalesValid()) {
      this.toast.show({
        message:
          'Please complete all interpretations before publishing the test',
        type: 'error',
      });

      const firstInvalidIndex = this.scales.findIndex(
        (scale) => !this.isScaleValid(scale.id!)
      );
      const element =
        this.interpretationCards?.get(firstInvalidIndex)?.nativeElement;

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-red-400');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-red-400');
        }, 2000);
      }

      return;
    }

    if (this.mode === 'new' && this.testInterpretations.length === 0) {
      this.toast.show({
        message: 'Please save interpretations before publishing the test',
        type: 'error',
      });
      return;
    }

    if (
      this.mode === 'edit' &&
      Object.values(this.interpretationsPerScale).some((array) =>
        array.controls.some((ctrl) => ctrl.dirty || ctrl.touched)
      )
    ) {
      this.toast.show({
        message: 'You have unsaved changes. Please save before publishing',
        type: 'warning',
      });
      return;
    }

    this.testState.currentStep = this.step;
    this.testState.state = 'active';

    try {
      const savedState = await firstValueFrom(
        this.testService.updateTestStateStep(this.testId, this.testState)
      );

      if (savedState) {
        this.toast.show({
          message: 'Test saved successfully',
          type: 'success',
        });
        this.router.navigate(['/']);
      } else {
        this.toast.show({
          message: 'Error updating test state',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error updating test state:', error);
      this.toast.show({
        message: 'Unexpected error while updating test',
        type: 'error',
      });
    }
  }

  onStepSelected(step: number): void {
    if (this.hasUnsavedChanges()) {
      this.pendingStep = step;
      this.confirmNavigationVisible = true;
      return;
    }

    this.navigateToStep(step);
  }

  navigateToStep(step: number): void {
    const id = this.testId || this.sessionStorage.getTestId();
    if (!id || !stepRoutes[step]) return;
    this.router.navigate(stepRoutes[step](id));
  }

  confirmNavigationVisible = false;
  confirmNavigationMessage =
    'Are you sure you want to proceed? All unsaved changes will be lost';
  pendingStep: number | null = null;

  onConfirmNavigation(): void {
    if (this.pendingStep !== null) {
      this.navigateToStep(this.pendingStep);
    }
    this.resetNavigationState();
  }

  onCancelNavigation(): void {
    this.resetNavigationState();
  }

  resetNavigationState(): void {
    this.confirmNavigationVisible = false;
    this.pendingStep = null;
  }

  hasUnsavedChanges(): boolean {
    return Object.values(this.interpretationsPerScale).some((array) =>
      array.controls.some((ctrl) => ctrl.dirty || ctrl.touched)
    );
  }

  markAllAsPristine(): void {
    for (const formArray of Object.values(this.interpretationsPerScale)) {
      formArray.controls.forEach((ctrl) => {
        ctrl.markAsPristine();
        ctrl.markAsUntouched();

        Object.values(ctrl.controls).forEach((control) => {
          control.markAsPristine();
          control.markAsUntouched();
        });
      });
    }
  }

  beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  @ViewChildren('interpretation') interpretationCards!: QueryList<
    ElementRef<HTMLElement>
  >;
}
