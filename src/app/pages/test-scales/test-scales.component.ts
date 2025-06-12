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
import { stepRoutes } from '../../constants/step-routes';
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { ListItemComponent } from '../../components/list-item/list-item.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { NgIf } from '@angular/common';


@Component({
  selector: 'app-test-scales',
  imports: [ReactiveFormsModule, SentencecasePipe, ProgressBarComponent, ListItemComponent, ConfirmDialogComponent, NgIf],
  templateUrl: './test-scales.component.html',
  styleUrl: './test-scales.component.css'
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

    if (!id) {
      console.warn('[TestScalesComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.sessionStorage.setTestId(id);

    await firstValueFrom(this.testContextService.ensureContext(this.testId, this.mode));

    this.testContextService.getTest().subscribe(test => {
      if (test) {
        this.testState = test.state ?? null;
      }
    });

    this.testContextService.getBlocks().subscribe(blocks => {
      this.blocks = blocks || [];
      this.newScaleForm.patchValue({
        blockId: this.blocks[0]?.id || null,
      });
    });

    this.testContextService.getScales().subscribe(scales => {
      this.scales = scales || [];
    });

    this.addValidatorsToForm();
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
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
        pole2Control?.setValidators([Validators.required, Validators.minLength(5)]);
      } else {
        pole2Control?.clearValidators();
      }
      pole2Control?.updateValueAndValidity();
    });
  }

  addNewScale() {
    if (this.newScaleForm.invalid) {
      this.newScaleForm.markAllAsTouched();
      this.toast.show({
        message: 'Please fill in all required fields correctly before adding a scale',
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

  onEditScale(scale: Scale) {
    this.newScaleForm.patchValue({
      scaleType: scale.scaleType,
      pole1: scale.pole1,
      pole2: scale.pole2 ?? '',
      blockId: scale.blockId,
    });

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

    const form = this.newScaleForm.value as {
      scaleType: string;
      pole1: string;
      pole2?: string;
      blockId: number;
    };
    const updated: Scale = {
      ...this.selectedScale,
      scaleType: form.scaleType,
      pole1: form.pole1,
      pole2: form.pole2,
      blockId: Number(form.blockId),
    };

    if (!this.selectedScale.id) {
      const index = this.pendingScales.findIndex(s => s === this.selectedScale);
      if (index !== -1) {
        this.pendingScales[index] = updated;
        this.toast.show({ message: 'Pending scale updated', type: 'success' });
      }
    } else {
      await firstValueFrom(this.testService.updateScale(updated.id!, updated));
      this.toast.show({ message: 'Scale updated successfully!', type: 'success' });
      await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, 'edit', true));
    }

    this.cancelEdit();
  }

  confirmDelete(scale: Scale) {
    this.selectedScale = scale;
    this.showDeleteDialog = true;
  }

  async handleDeleteConfirmed() {
    if (!this.selectedScale) return;

    if (!this.selectedScale.id) {
      this.pendingScales = this.pendingScales.filter(s => s !== this.selectedScale);
      this.toast.show({ message: 'Pending scale removed', type: 'info' });
    } else if (this.testId) {
      try {
        await firstValueFrom(this.testService.deleteScale(this.selectedScale.id));
        this.toast.show({ message: 'Scale deleted successfully!', type: 'success' });
        await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, 'edit', true));
      }
      catch (error) {
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
    return control && control.touched ? this.validationService.getErrorMessage(control, field) : null;
  }

  get allScales(): Scale[] {
    return [...this.scales, ...this.pendingScales];
  }

  async saveTest(navigate: boolean = false): Promise<void> {
    if (this.isEditing) {
      this.toast.show({ message: 'Finish editing the scale before saving the test.', type: 'warning' });
      return;
    }

    if (this.pendingScales.length === 0 && this.scales.length === 0) {
      this.toast.show({ message: 'You must add at least one scale to save the test.', type: 'warning' });
      return;
    }

    if (!this.testState || !this.testId) return;

    if (this.pendingScales.length > 0) {
      await firstValueFrom(this.testService.addScalesBatch(this.testId, this.pendingScales));
      this.toast.show({ message: 'All scales saved!', type: 'success' });
      this.pendingScales = [];
      await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, 'edit', true));
    }

    if (this.testState.currentStep < 3) {
      this.testState.currentStep = 3;
      await firstValueFrom(this.testService.updateTestStateStep(this.testId, this.testState));
      await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, 'edit', true));
      this.router.navigate(['/test-scales/edit', this.testId]);
      return;
    }

    this.resourceService.triggerRefresh();

    if (navigate) this.handleNavigation(this.testState);
  }

  private handleNavigation(testState: State) {
    const step = testState.currentStep;
    if (step === 3) {
      this.toast.show({
        message: 'Going to next step...',
        type: 'info',
      });
      setTimeout(() => {
        this.router.navigate(['/test-questions/new']);
      }, 700);
    } else if (step > 3) {
      if (!this.testId) {
        console.error('Cannot navigate to edit: testId is missing');
        return;
      }
      this.router.navigate(['/test-questions/edit/', this.testId]);
    }
  }

  onStepSelected(step: number) {
    const id = this.testId || this.sessionStorage.getTestId(); 
    if (!id || !stepRoutes[step]) return;
    this.router.navigate(stepRoutes[step](id));
  }
}


