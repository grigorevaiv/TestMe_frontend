import {
  Component,
  effect,
  ElementRef,
  inject,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Norm, Scale, Weight } from '../../interfaces/test.interface';
import { TestService } from '../../services/test.service';
import { ResourceService } from '../../services/resource.service';
//import { CacheService } from '../../services/cache.service';
import { ToastService } from '../../services/toast.service';
import { NgClass, NgIf } from '@angular/common';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { stepRoutes, stepRoutesNew } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { StepRedirectService } from '../../services/step-redirect.service';

@Component({
  selector: 'app-test-norms',
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgClass,
    ProgressBarComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './test-norms.component.html',
  styleUrl: './test-norms.component.css',
})
export class TestNormsComponent {
  testService = inject(TestService);
  resourceService = inject(ResourceService);
  fb = inject(FormBuilder);
  router = inject(Router);
  route = inject(ActivatedRoute);
  //cacheService = inject(CacheService);
  sessionStorage = inject(SessionStorageService);
  stepRedirectService = inject(StepRedirectService);

  mode: string = '';
  testState: any = null;
  testId: number | null = null;
  norms: Norm[] = [];
  scales: Scale[] = [];
  weights: Weight[] = [];
  toast = inject(ToastService);
  step = 7;
  testContextService = inject(TestContextService);

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
          7,
          (id) => ['/test-norms/edit', id]
        );
      if (redirected) return;
    }

    if (!id) {
      console.warn('[TestNormsComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.sessionStorage.setTestId(id);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    await firstValueFrom(
      this.testContextService.ensureContext(this.testId, this.mode, 7)
    );

    this.testContextService.getTest().subscribe((test) => {
      this.testState = test?.state ?? null;
      this.testId = test?.id ?? this.testId;
    });

    this.testContextService.getScales().subscribe((scales) => {
      if (scales) {
        console.log('Scales received:', scales);
        this.scales = scales;
        this.initializeNormsForms();
      }
    });

    this.testContextService.getNorms().subscribe((norms) => {
      if (norms) {
        console.log('Norms received:', norms);
        this.norms = norms;
        this.patchNormsToForm(norms);
      } else {
        console.log('No norms found for testId:', this.testId);
      }
    });

    this.testContextService.getWeights().subscribe((weights) => {
      if (weights) {
        console.log('Weights received:', weights);
        this.weights = weights;
      }
    });
  }

  normsForScale: { [scaleId: number]: FormGroup } = {};

  initializeNormsForms() {
    this.scales.forEach((scale: Scale) => {
      if (scale.id === undefined) return;
      this.normsForScale[scale.id] = this.createNormsForm();
    });
  }

  getNormsFormForScale(scaleId: number): FormGroup {
    return this.normsForScale[scaleId];
  }

  get completedStepsArray(): number[] {
    const currentStep = this.testState?.currentStep ?? 0;
    return Array.from({ length: currentStep }, (_, i) => i + 1);
  }

  createNormsForm(): FormGroup {
    return this.fb.group({
      id: [null],
      mean: [0, Validators.required],
      stdDev: [0, Validators.required],
      type: ['', Validators.required],
    });
  }

  setTheoreticalNorms(scaleId: number) {
    const scaleWeights = this.weights.filter(
      (weight: any) => Number(weight.scaleId) === Number(scaleId)
    );
    console.log('Scale Weights:', scaleWeights);
    const isGradual = this.isGradualScale(scaleWeights);
    console.log('Is Gradual Scale:', isGradual);
    if (!scaleWeights.length) {
      console.warn(`No weights found for scaleId ${scaleId}`);
      return;
    }
    let min = 0;
    let max = 0;
    if (isGradual) {
      const grouped = new Map<number, number[]>();
      for (const w of scaleWeights) {
        const qId = w.answer?.questionId;
        if (!qId) continue;
        if (!grouped.has(qId)) grouped.set(qId, []);
        grouped.get(qId)!.push(w.value);
      }

      for (const values of grouped.values()) {
        min += Math.min(...values);
        max += Math.max(...values);
      }
    } else {
      min = scaleWeights.reduce(
        (acc: number, obj: any) => (obj.value <= 0 ? acc + obj.value : acc),
        0
      );
      max = scaleWeights.reduce(
        (acc: number, obj: any) => (obj.value > 0 ? acc + obj.value : acc),
        0
      );
    }

    const mean = ((min + max) / 2).toFixed(1);
    const stdDev = ((max - min) / 6).toFixed(1);

    const scaleNorms = this.getNormsFormForScale(scaleId).controls;
    scaleNorms['mean'].setValue(mean);
    scaleNorms['stdDev'].setValue(stdDev);

    console.log(
      `Scale ${scaleId} → min: ${min}, max: ${max}, mean: ${mean}, stdDev: ${stdDev}`
    );
  }

  isGradualScale(weights: any[]): boolean {
    const grouped = new Map<number, number[]>();

    for (const w of weights) {
      const questionId = w.answer?.questionId;
      if (!questionId) continue;
      if (!grouped.has(questionId)) grouped.set(questionId, []);
      grouped.get(questionId)!.push(w.value);
    }

    for (const values of grouped.values()) {
      const unique = new Set(values);
      const hasMultipleAnswers = unique.size > 1;
      const hasHighValues = [...unique].some((v) => v > 1);
      if (hasMultipleAnswers && hasHighValues) return true;
    }

    return false;
  }

  isAllFieldsFilled(): boolean {
    return Object.values(this.normsForScale).every(
      (formGroup) =>
        formGroup.get('mean')?.value !== 0 &&
        formGroup.get('stdDev')?.value !== 0 &&
        formGroup.get('type')?.value !== ''
    );
  }

  get isFormCompletelyFilled(): boolean {
    return this.isAllFieldsFilled();
  }

  patchNormsToForm(norms: Norm[]) {
    norms.forEach((norm) => {
      const scaleId = norm.scaleId;
      if (this.normsForScale[scaleId]) {
        this.normsForScale[scaleId].patchValue({
          id: norm.id,
          mean: norm.mean,
          stdDev: norm.stdDev,
          type: norm.type,
        });
      } else {
        console.warn(`No form found for scaleId ${scaleId}`);
      }
    });
  }

  async createNorms(): Promise<Norm[]> {
    const newNorms = Object.entries(this.normsForScale)
      .filter(([scaleId]) => !this.norms?.some((n) => n.scaleId === +scaleId))
      .map(([scaleId, normsForm]) => ({
        scaleId: +scaleId,
        mean: normsForm.get('mean')?.value,
        stdDev: normsForm.get('stdDev')?.value,
        type: normsForm.get('type')?.value,
      }));

    if (newNorms.length === 0) return [];

    const savedNorms = await firstValueFrom(
      this.testService.addNormsToScales(newNorms)
    );
    return savedNorms;
  }

  async updateNorms(): Promise<Norm[]> {
    if (!this.isAllValid()) {
      this.toast.show({
        message: 'Please fill all fields before saving',
        type: 'error',
      });
      return [];
    }
    const existingNorms = Object.entries(this.normsForScale)
      .filter(
        ([scaleId, normsForm]) =>
          normsForm.valid && this.norms?.some((n) => n.scaleId === +scaleId)
      )
      .map(([scaleId, normsForm]) => {
        const existing = this.norms?.find((n) => n.scaleId === +scaleId);
        return {
          id: existing!.id,
          scaleId: +scaleId,
          mean: normsForm.get('mean')?.value,
          stdDev: normsForm.get('stdDev')?.value,
          type: normsForm.get('type')?.value,
        };
      });

    console.log('Updating norms payload:', existingNorms);
    if (existingNorms.length === 0) return [];

    const updatedNorms = await firstValueFrom(
      this.testService.updateNorms(existingNorms)
    );
    return updatedNorms;
  }

  confirmNavigationVisible = false;
  confirmNavigationMessage =
    'Are you sure you want to proceed? All unsaved changes will be lost';
  pendingStep: number | null = null;

  async saveNorms(): Promise<Norm[] | null> {
    console.log('Test state [NormsComponent]:', this.testState);
    if (!this.isAllValid()) {
      Object.values(this.normsForScale).forEach((f) => f.markAllAsTouched());
      this.scrollToFirstInvalidNorm();
      this.toast.show({
        message: 'Please fill all fields before saving',
        type: 'error',
      });
      return [];
    }

    try {
      let savedNorms: Norm[] = [];
      if (this.norms && this.norms.length > 0) {
        console.log('I see this norms', this.norms);
        savedNorms = await this.updateNorms();
        this.toast.show({
          message: 'Norms updated successfully',
          type: 'success',
        });
      } else {
        savedNorms = await this.createNorms();
        this.toast.show({
          message: 'Norms saved successfully',
          type: 'success',
        });
      }

      this.markAllNormsPristine();

      if (this.testState?.currentStep < 7 && this.testId) {
        this.testState.currentStep = 7;
        this.testState = await firstValueFrom(
          this.testService.updateTestStateStep(this.testId, this.testState)
        );
        this.router.navigate(['/test-norms/edit', this.testId]);
      }

      await firstValueFrom(
        this.testContextService.loadContextIfNeeded(
          this.testId!,
          'edit',
          7,
          true
        )
      );
      return savedNorms;
    } catch (error) {
      console.log('Error while saving norms:', error);
      this.toast.show({ message: 'Failed to save norms', type: 'error' });
      return null;
    }
  }

  navigate(): void {
    if (this.hasUnsavedChanges() && this.mode === 'edit') {
      this.pendingStep = (this.testState?.currentStep ?? 1) + 1;
      this.confirmNavigationVisible = true;
      return;
    }

    if (
      (this.hasUnsavedChanges() || this.areAllNormsZero()) &&
      this.mode === 'new'
    ) {
      this.toast.show({
        message: 'Please save the changes before proceeding',
        type: 'warning',
      });
      return;
    }

    if (!this.isAllValid()) {
      this.toast.show({
        message: 'Please fill in all the required fields',
        type: 'warning',
      });
      return;
    }

    this.toast.show({ message: 'Going to the next step...', type: 'info' });

    setTimeout(() => {
      const route =
        this.testState?.currentStep === 7
          ? ['/test-interpretations/new']
          : ['/test-interpretations/edit', this.testId];
      this.router.navigate(route);
    }, 700);
  }

  hasUnsavedChanges(): boolean {
    return Object.values(this.normsForScale).some(
      (form) => form.dirty || form.touched
    );
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
    const currentStep = this.testState?.currentStep ?? 1;

    if (!id || !stepRoutes[step]) return;

    const isForward = step > currentStep;
    const route = isForward ? stepRoutesNew[step]() : stepRoutes[step](id);

    this.router.navigate(route);
  }

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

  markAllNormsPristine(): void {
    for (const form of Object.values(this.normsForScale)) {
      form.markAsPristine();
      form.markAsUntouched();

      Object.values(form.controls).forEach((control) => {
        control.markAsPristine();
        control.markAsUntouched();
      });
    }
  }

  isAllValid(): boolean {
    return Object.values(this.normsForScale).every((form) => form.valid);
  }

  isNormInvalid(scaleId: number): boolean {
    const form = this.getNormsFormForScale(scaleId);
    const mean = form.get('mean')?.value;
    const stdDev = form.get('stdDev')?.value;
    const type = form.get('type')?.value;

    const isEmpty = mean === 0 && stdDev === 0 && !type;
    return form.invalid || isEmpty;
  }

  hasAllZeroValues(scaleId: number): boolean {
    const form = this.getNormsFormForScale(scaleId);
    const mean = form.get('mean')?.value;
    const stdDev = form.get('stdDev')?.value;
    return mean === 0 && stdDev === 0;
  }

  areAllNormsZero(): boolean {
    return Object.keys(this.normsForScale).every((scaleId) =>
      this.hasAllZeroValues(+scaleId)
    );
  }

  wasFormTouched(scaleId: number): boolean {
    const form = this.getNormsFormForScale(scaleId);
    return (
      !!form.get('mean')?.touched ||
      !!form.get('stdDev')?.touched ||
      !!form.get('type')?.touched
    );
  }

  @ViewChildren('normBlock') normBlocks!: QueryList<ElementRef>;

  scrollToFirstInvalidNorm(): void {
    const invalidIndex = this.scales.findIndex((scale) =>
      this.isNormInvalid(scale.id!)
    );

    if (invalidIndex >= 0) {
      setTimeout(() => {
        const el = this.normBlocks.get(invalidIndex)
          ?.nativeElement as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });

          el.classList.add('ring-2', 'ring-red-400');

          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-red-400');
          }, 2000);
        }
      }, 0);
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
}
