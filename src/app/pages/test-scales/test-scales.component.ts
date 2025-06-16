import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Block, Scale, State } from '../../interfaces/test.interface';
import { ResourceService } from '../../services/resource.service';
//import { CacheService } from '../../services/cache.service';
import { TestService } from '../../services/test.service';
import { ValidationService } from '../../services/validation.service';
import { ToastService } from '../../services/toast.service';
import { stepRoutes, stepRoutesNew } from '../../constants/step-routes';
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { ListItemComponent } from '../../components/list-item/list-item.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { NgIf } from '@angular/common';
import { StepRedirectService } from '../../services/step-redirect.service';
import { constrainedMemory } from 'process';

@Component({
  selector: 'app-test-scales',
  imports: [
    ReactiveFormsModule,
    SentencecasePipe,
    ProgressBarComponent,
    ListItemComponent,
    ConfirmDialogComponent,
    NgIf,
  ],
  templateUrl: './test-scales.component.html',
  styleUrl: './test-scales.component.css',
})
export class TestScalesComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  //private cacheService = inject(CacheService);
  private sessionStorage = inject(SessionStorageService);
  private testService = inject(TestService);
  private validationService = inject(ValidationService);
  resourceService = inject(ResourceService);
  toast = inject(ToastService);
  private testContextService = inject(TestContextService);
  stepRedirectService = inject(StepRedirectService);

  testId: number | null = null;
  mode: string = '';
  step: number = 3;
  blocks: Block[] = [];
  scales: Scale[] = [];
  pendingScales: Scale[] = [];
  selectedScale: Scale | null = null;
  testState: State | null = null;
  isEditing = false;
  editingScaleId: number | null = null;
  showDeleteDialog = false;

  newScaleForm = this.fb.group({
    scaleType: ['unipolar' as string, [Validators.required]],
    pole1: ['' as string, [Validators.required, Validators.minLength(5)]],
    pole2: ['' as string],
    blockId: [null as number | null, [Validators.required]],
  });

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
          3,
          (id) => ['/test-scales/edit', id]
        );
      if (redirected) return;
    }

    if (!id) {
      console.warn('[TestScalesComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.sessionStorage.setTestId(id);
    this.addValidatorsToForm();
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    await firstValueFrom(
      this.testContextService.ensureContext(this.testId, this.mode, 3)
    );

    this.testContextService.getTest().subscribe((test) => {
      if (test) {
        this.testState = test.state ?? null;
      }
    });

    this.testContextService.getBlocks().subscribe((blocks) => {
      this.blocks = blocks || [];
      this.newScaleForm.patchValue({
        blockId: this.blocks[0]?.id || null,
      });
    });

    this.testContextService.getScales().subscribe((scales) => {
      this.scales = scales || [];
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (this.isEditing || this.pendingScales.length > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  get completedStepsArray(): number[] {
    const currentStep = this.testState?.currentStep ?? 0;
    return Array.from({ length: currentStep }, (_, i) => i + 1);
  }

  private addValidatorsToForm() {
    this.newScaleForm.get('scaleType')?.valueChanges.subscribe((type) => {
      const pole2Control = this.newScaleForm.get('pole2');
      if (type === 'bipolar') {
        pole2Control?.setValidators([
          Validators.required,
          Validators.minLength(5),
        ]);
      } else {
        pole2Control?.clearValidators();
      }
      pole2Control?.updateValueAndValidity();
    });
  }

  addNewScale() {
    if ((this.testState?.currentStep ?? 1) > 3) {
      this.toast.show({
        message: 'You cannot add scales after defining questions',
        type: 'warning',
      });
      return;
    }
    if (this.newScaleForm.invalid) {
      this.newScaleForm.markAllAsTouched();
      this.toast.show({
        message:
          'Please fill in all required fields correctly before adding a scale',
        type: 'warning',
      });
      return;
    }

    const newScale = this.newScaleForm.value as Scale;
    this.pendingScales.push({
      ...newScale,
      testId: this.testId!,
    });
    this.toast.show({ message: 'Scale added to list', type: 'info' });

    this.resetToDefault();
  }

  resetToDefault() {
    this.newScaleForm.reset({
      scaleType: 'unipolar',
      pole1: '',
      pole2: '',
      blockId: this.blocks[0]?.id || null,
    });
    this.isEditing = false;
    this.newScaleForm.markAsUntouched();
  }

  onEditScale(scale: Scale): void {
    const currentStep = this.testState?.currentStep ?? 1;

    this.newScaleForm.patchValue({
      scaleType: scale.scaleType,
      pole1: scale.pole1,
      pole2: scale.pole2 ?? '',
      blockId: scale.blockId,
    });

    if (currentStep >= 6) {
      this.newScaleForm.get('scaleType')?.disable();
      this.newScaleForm.get('blockId')?.disable();
    } else {
      this.newScaleForm.get('scaleType')?.enable();
      this.newScaleForm.get('blockId')?.enable();
    }

    this.editingScaleId = scale.id ?? null;
    this.isEditing = true;
    this.selectedScale = scale;
  }

  cancelEdit() {
    this.resetToDefault();
    this.selectedScale = null;
    this.editingScaleId = null;
    this.isEditing = false;
  }

  async updateScale() {
    if (!this.selectedScale || !this.testId) return;

    const form = this.newScaleForm.getRawValue();

    const scaleType = this.newScaleForm.get('scaleType')?.value ?? 'bipolar';
    const blockId = Number(this.newScaleForm.get('blockId')?.value);
    const updated: Scale = {
      ...this.selectedScale,
      scaleType,
      pole1: form.pole1 ?? '',
      pole2: form.pole2 ?? '',
      blockId,
    };

    if (!this.selectedScale.id) {
      const index = this.pendingScales.findIndex(
        (s) => s === this.selectedScale
      );
      if (index !== -1) {
        this.pendingScales[index] = updated;
        this.toast.show({ message: 'Pending scale updated', type: 'success' });
      }
    } else {
      await firstValueFrom(this.testService.updateScale(updated.id!, updated));
      this.toast.show({
        message: 'Scale updated successfully!',
        type: 'success',
      });
      await firstValueFrom(
        this.testContextService.loadContextIfNeeded(
          this.testId,
          'edit',
          3,
          true
        )
      );
    }
    this.cancelEdit();
  }

  confirmDelete(scale: Scale) {
    if ((this.testState?.currentStep ?? 1) > 3) {
      this.toast.show({
        message: 'You cannot delete scales after defining questions',
        type: 'warning',
      });
      return;
    }
    this.selectedScale = scale;
    this.showDeleteDialog = true;
  }

  async handleDeleteConfirmed() {
    if (!this.selectedScale) return;

    if (!this.selectedScale.id) {
      this.pendingScales = this.pendingScales.filter(
        (s) => s !== this.selectedScale
      );
      this.toast.show({ message: 'Scale removed', type: 'info' });
    } else if (this.testId) {
      try {
        await firstValueFrom(
          this.testService.deleteScale(this.selectedScale.id)
        );
        this.toast.show({
          message: 'Scale deleted successfully',
          type: 'success',
        });
        await firstValueFrom(
          this.testContextService.loadContextIfNeeded(
            this.testId,
            'edit',
            3,
            true
          )
        );
      } catch (error) {
        console.error('Error deleting scale:', error);
        this.toast.show({ message: 'Failed to delete scale', type: 'error' });
      }
    }

    this.showDeleteDialog = false;
    this.selectedScale = null;
  }

  handleDeleteCancelled() {
    this.showDeleteDialog = false;
    this.selectedScale = null;
  }

  getError(field: string): string | null {
    const control = this.newScaleForm.get(field);
    return control && control.touched
      ? this.validationService.getErrorMessage(control, field)
      : null;
  }

  get allScales(): Scale[] {
    return [...this.scales, ...this.pendingScales];
  }

  isSaved = false;
  confirmDialogVisible = false;
  confirmDialogMessage =
    'Are you sure you want to proceed? All unsaved changes will be lost';
  pendingStep: number | null = null;

  async saveTest(): Promise<void> {
    if (this.isEditing) {
      this.toast.show({
        message: 'Finish editing the scale before saving the test',
        type: 'warning',
      });
      return;
    }

    if (this.pendingScales.length === 0 && this.scales.length === 0) {
      this.toast.show({
        message: 'You must add at least one scale to save the test',
        type: 'warning',
      });
      return;
    }

    if (!this.testState || !this.testId) return;

    if (this.pendingScales.length > 0) {
      await firstValueFrom(
        this.testService.addScalesBatch(this.testId, this.pendingScales)
      );
      this.toast.show({ message: 'All scales saved', type: 'success' });
      this.pendingScales = [];
      await firstValueFrom(
        this.testContextService.loadContextIfNeeded(
          this.testId,
          'edit',
          3,
          true
        )
      );
      this.isSaved = true;
    }

    if (this.testState.currentStep < 3) {
      this.testState.currentStep = 3;
      await firstValueFrom(
        this.testService.updateTestStateStep(this.testId, this.testState)
      );
      await firstValueFrom(
        this.testContextService.loadContextIfNeeded(
          this.testId,
          'edit',
          3,
          true
        )
      );
      this.router.navigate(['/test-scales/edit', this.testId]);
      return;
    }

    this.resourceService.triggerRefresh();
  }

  onStepSelected(step: number): void {
    const id = this.testId || this.sessionStorage.getTestId();
    if (!id || !stepRoutes[step]) return;

    const editing = this.isEditing;
    const hasUnsaved = this.pendingScales.length > 0;

    if (!editing && !hasUnsaved) {
      this.navigateToStep(step);
      return;
    }

    this.pendingStep = step;
    this.confirmDialogVisible = true;
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

  resetNavigationState(): void {
    this.confirmDialogVisible = false;
    this.pendingStep = null;
  }

  onCancelNavigation(): void {
    this.resetNavigationState();
  }

  navigate(): void {
    const hasUnsaved =
      this.pendingScales.length === 0 && this.scales.length > 0;

    if (hasUnsaved) {
      this.toast.show({ message: 'Going to next step...', type: 'info' });

      setTimeout(() => {
        const route =
          this.testState?.currentStep === 3
            ? ['/test-questions/new']
            : ['/test-questions/edit', this.testId];
        this.router.navigate(route);
      }, 700);
    } else {
      if (this.mode === 'new') {
        this.toast.show({
          message: 'Please save the test before proceeding',
          type: 'warning',
        });
      } else {
        this.pendingStep = 4;
        this.confirmDialogVisible = true;
      }
    }
  }

  getBlockName(blockId: number): string {
    return this.blocks.find(b => b.id === blockId)?.name ?? `Block #${blockId}`;
  }

}
