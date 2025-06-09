import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
//import { CacheService } from '../../services/cache.service';
import { TestService } from '../../services/test.service';
import { ValidationService } from '../../services/validation.service';
import { ResourceService } from '../../services/resource.service';
import { Block, State } from '../../interfaces/test.interface';
import { firstValueFrom } from 'rxjs';

import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { ListItemComponent } from '../../components/list-item/list-item.component';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { stepRoutes } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-test-blocks',
  imports: [ReactiveFormsModule, SentencecasePipe, ListItemComponent, ConfirmDialogComponent, ProgressBarComponent, NgIf],
  templateUrl: './test-blocks.component.html',
  styleUrl: './test-blocks.component.css'
})
export class TestBlocksComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  //private cacheService = inject(CacheService);
  private sessionStorage = inject(SessionStorageService);
  private testService = inject(TestService);
  private router = inject(Router);
  private validationService = inject(ValidationService);
  resourceService = inject(ResourceService);
  toast = inject(ToastService);
  private testContextService = inject(TestContextService);

  private routeParamSubscription: any;
  private testId: number | null = null;
  testState: State | null = null;
  mode: string = '';
  step: number = 2;
  completedSteps: number[] = [];
  isEditing = false;
  editingBlockId: number | null = null;
  blocks: Block[] = [];
  showDeleteDialog = false;
  isBlockFormActive: boolean = false;
  pendingBlocks: Block[] = [];


  newBlockForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(5)]],
    instructions: ['', [Validators.required, Validators.minLength(100)]],
    hasTimeLimit: [false],
    timeLimit: [0],
    randomizeQuestions: [false],
    randomizeAnswers: [false],
    numberOfQuestions: [5, [Validators.required, Validators.min(5)]],
    questionsType: ['single-choice', [Validators.required]],
    numberOfAnswers: [3, [Validators.required, Validators.min(2)]],
    testId: this.testId
  });


  async ngOnInit(): Promise<void> {
    this.testContextService.resetContext();
    const idParam = this.route.snapshot.paramMap.get('testId');
    const mode = this.route.snapshot.paramMap.get('mode') || 'new';
    const storedId = this.sessionStorage.getTestId();
    const id = idParam ? Number(idParam) : storedId;

    if (!id) {
      console.warn('[TestBlocksComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;

    await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, this.mode));

    this.testContextService.getTest().subscribe(test => {
      if (test) {
        this.testState = test.state ?? null;
      }
    });

    this.testContextService.getBlocks().subscribe(blocks => {
      this.blocks = blocks || [];
    });

    this.addValidatorsToForm();
    window.addEventListener('beforeunload', this.beforeUnloadHandler.bind(this));
  }

  beforeUnloadHandler(event: BeforeUnloadEvent) {
  if (this.pendingBlocks.length > 0) {
    event.preventDefault();
    event.returnValue = 'You have unsaved blocks. Are you sure you want to leave?';
    return event;
  }
  return;
}


  private addValidatorsToForm() {
    this.newBlockForm.get('hasTimeLimit')?.valueChanges.subscribe((hasTimeLimit) => {
      if (hasTimeLimit) {
        this.newBlockForm.get('timeLimit')?.setValidators([Validators.required, Validators.min(10)]);
      } else {
        this.newBlockForm.get('timeLimit')?.clearValidators();
      }
      this.newBlockForm.get('timeLimit')?.updateValueAndValidity();
    });
  }

  get completedStepsArray(): number[] {
    const currentStep = this.testState?.currentStep ?? 0;
    return Array.from({ length: currentStep }, (_, i) => i + 1);
  }

  addNewBlock() {
    if (this.newBlockForm.invalid) {
      this.newBlockForm.markAllAsTouched();
      this.toast.show({
        message: 'Please fill in all required fields correctly before adding a block',
        type: 'warning'
      });
      return;
    }

    const newBlock = this.prepareBlockForSaving();
    this.pendingBlocks.push(newBlock);
    this.toast.show({ message: 'Block added to list', type: 'info' });

    this.resetToDefault();
    this.isBlockFormActive = false;
  }


  resetToDefault() {
    this.newBlockForm.reset({
      name: '',
      instructions: '',
      hasTimeLimit: false,
      timeLimit: 0,
      randomizeQuestions: false,
      randomizeAnswers: false,
      numberOfQuestions: 5,
      questionsType: 'single-choice',
      numberOfAnswers: 3,
    });
    this.isBlockFormActive = false;
    this.newBlockForm.markAsUntouched();
  }

  private prepareBlockForSaving(): Block {
    if (!this.newBlockForm.value.hasTimeLimit) {
      delete this.newBlockForm.value.hasTimeLimit;
      delete this.newBlockForm.value.timeLimit;
    }
    this.newBlockForm.value.testId = this.testId;
    console.log(this.newBlockForm.value);
    return this.newBlockForm.value as Block;
  }

  onEditBlock(block: Block): void {
    const isPending = !block.id;
    this.newBlockForm.patchValue({
      name: block.name,
      instructions: block.instructions,
      hasTimeLimit: block.hasTimeLimit,
      randomizeQuestions: block.randomizeQuestions,
      randomizeAnswers: block.randomizeAnswers,
      numberOfQuestions: block.numberOfQuestions,
      questionsType: block.questionsType,
      numberOfAnswers: block.numberOfAnswers,
      timeLimit: block.timeLimit,
    });

    this.editingBlockId = block.id ?? null;
    this.isEditing = true;


    this.selectedBlock = block;
  }


  onDeleteBlock(block: Block): void {
    if (this.testId) {
      this.testService.deleteBlock(this.testId, block.id!).subscribe(() => {
        console.log('Block deleted:', block);
        this.resourceService.triggerRefresh();
      });
    }
  }

  selectedBlock: Block | null = null;
  confirmDelete(block: Block) {
    this.selectedBlock = block;
    this.showDeleteDialog = true;
  }

  handleDeleteConfirmed() {
    if (!this.selectedBlock) return;

    const block = this.selectedBlock;

    if (!block.id) {
  
      this.pendingBlocks = this.pendingBlocks.filter(b => b !== block);
      this.toast.show({ message: 'Block removed', type: 'info' });
    } else if (this.testId) {

      this.testService.deleteBlock(this.testId, block.id).subscribe(() => {
        this.toast.show({ message: 'Block deleted', type: 'success' });
        this.resourceService.triggerRefresh();
      });
    }

    this.showDeleteDialog = false;
    this.selectedBlock = null;
  }


  handleDeleteCancelled() {
    this.showDeleteDialog = false;
    this.selectedBlock = null;
    this.isBlockFormActive = false;
  }

  async updateBlock() {
    if (!this.selectedBlock) return;
    const rawForm = this.newBlockForm.value;

    const cleanedForm: Partial<Block> = {
      name: rawForm.name ?? '',
      instructions: rawForm.instructions ?? '',
      hasTimeLimit: rawForm.hasTimeLimit ?? false,
      timeLimit: rawForm.timeLimit ?? 0,
      randomizeQuestions: rawForm.randomizeQuestions ?? false,
      randomizeAnswers: rawForm.randomizeAnswers ?? false,
      numberOfQuestions: rawForm.numberOfQuestions ?? 0,
      questionsType: rawForm.questionsType ?? 'single-choice',
      numberOfAnswers: rawForm.numberOfAnswers ?? 0,
    };

    const updatedBlock: Block = {
      ...this.selectedBlock,
      ...cleanedForm,
    };

    if (!this.selectedBlock.id) {

      const index = this.pendingBlocks.findIndex(b => b === this.selectedBlock);
      if (index !== -1) {
        this.pendingBlocks[index] = updatedBlock;
        this.toast.show({ message: 'Block updated', type: 'success' });
      }
    } else if (this.testId) {

      updatedBlock.testId = this.testId;
      await firstValueFrom(
        this.testService.updateBlock(this.testId, updatedBlock.id!, updatedBlock)
      );
      this.toast.show({ message: 'Block updated successfully!', type: 'success' });
      await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, 'edit'));
    }

    this.resetToDefault();
    this.isEditing = false;
    this.selectedBlock = null;
  }


  cancelEdit() {
    this.isEditing = false;
    this.editingBlockId = null;
    this.resetToDefault();
  }

  async saveTest(navigate: boolean = false): Promise<void> {
    console.log('Saving test with ID:', this.testId);
    console.log('Pending blocks:', this.pendingBlocks);
    console.log('Current blocks:', this.blocks);
    console.log('Test id:', this.testId);
    if (this.isEditing) {
      this.toast.show({ message: 'Finish editing the block before saving the test', type: 'warning' });
      return;
    }

    if (this.pendingBlocks.length === 0 && this.blocks.length === 0) {
      this.toast.show({ message: 'You must add at least one block to save the test', type: 'warning' });
      return;
    }

    if (!this.testState || !this.testId) return;

    if (this.pendingBlocks.length > 0) {
      await firstValueFrom(this.testService.addBlocksBatch(this.testId, this.pendingBlocks));
      this.toast.show({ message: 'All blocks saved', type: 'success' });
      await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, this.mode));
      this.pendingBlocks = [];
    }

    if (this.testState.currentStep < 2) {
      this.testState.currentStep = 2;
      await firstValueFrom(this.testService.updateTestStateStep(this.testId, this.testState));
      await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, 'edit'));
      this.router.navigate(['/test-blocks/edit', this.testId]);
      return;
    }

    this.resourceService.triggerRefresh();

    if (navigate) this.handleNavigation(this.testState);
  }


  private handleNavigation(testState: any) {
    const step = testState.currentStep;
    if (step === 2) {
      this.toast.show({
          message: 'Going to next step...',
          type: 'info'
      });
      setTimeout(() => {
        this.router.navigate(['/test-scales/new']);
      }, 700);

    } else if (step > 2) {
      if (!this.testId) {
        console.error('Cannot navigate to edit: testId is missing');
        return;
      }
      this.router.navigate(['/test-scales/edit/', this.testId]);
    }
  }

  getError(field: string): string | null {
    const control = this.newBlockForm.get(field);
    return control && control.touched ? this.validationService.getErrorMessage(control, field) : null;
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler.bind(this));
    if (this.routeParamSubscription) {
      this.routeParamSubscription.unsubscribe();
    }
  }

  get allBlocks(): Block[] {
    return [...this.blocks, ...this.pendingBlocks];
  }

  onStepSelected(step: number) {
    const id = this.testId || this.sessionStorage.getTestId(); 
    if (!id || !stepRoutes[step]) return;
    this.router.navigate(stepRoutes[step](id));
  }


}

