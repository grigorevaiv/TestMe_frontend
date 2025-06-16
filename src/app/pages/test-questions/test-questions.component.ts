import {
  Component,
  effect,
  ElementRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { ResourceService } from '../../services/resource.service';
//import { CacheService } from '../../services/cache.service';
import { Block, Question } from '../../interfaces/test.interface';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TestService } from '../../services/test.service';
import { combineLatest, firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ValidationService } from '../../services/validation.service';
import { ViewChild } from '@angular/core';
import { QuestionSelectorComponent } from '../../components/question-selector/question-selector.component';
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { NgClass, NgIf } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { stepRoutes, stepRoutesNew } from '../../constants/step-routes';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { TestContextService } from '../../services/test-context.service';
import { StepRedirectService } from '../../services/step-redirect.service';

@Component({
  selector: 'app-test-questions',
  imports: [
    ReactiveFormsModule,
    SentencecasePipe,
    QuestionSelectorComponent,
    NgClass,
    ProgressBarComponent,
    ConfirmDialogComponent,
    NgIf,
  ],
  templateUrl: './test-questions.component.html',
  styleUrl: './test-questions.component.css',
})
export class TestQuestionsComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sessionStorage = inject(SessionStorageService);
  private resourceService = inject(ResourceService);
  private validationService = inject(ValidationService);
  testService = inject(TestService);
  toast = inject(ToastService);
  private testContextService = inject(TestContextService);
  stepRedirectService = inject(StepRedirectService);

  testId: number | null = null;
  testState: any;
  blocks: Block[] = [];
  questions: Question[] = [];
  mode: string = '';
  step: number = 4;
  questionsOfBlock: { [blockId: number]: FormArray<FormGroup> } = {};
  imagePreviews: { [blockId: number]: { [questionIndex: number]: string } } =
    {};
  isQuestionsModified: { [blockId: number]: boolean } = {};
  questionsToDelete: number[] = [];
  isEditMode = false;

  @ViewChild(QuestionSelectorComponent, { static: false })
  selectorComponent?: QuestionSelectorComponent;

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
          4,
          (id) => ['/test-questions/edit', id]
        );
      if (redirected) return;
    }

    if (!id) {
      console.warn('[TestQuestionsComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.isEditMode = this.mode !== 'new';
    this.sessionStorage.setTestId(id);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    await firstValueFrom(
      this.testContextService.ensureContext(this.testId, this.mode, 4)
    );

    this.testContextService.getTest().subscribe((test) => {
      this.testState = test?.state ?? null;
    });

    combineLatest([
      this.testContextService.getBlocks(),
      this.testContextService.getQuestions(),
    ]).subscribe(([blocks, questions]) => {
      this.blocks = blocks || [];
      this.questions = questions || [];

      this.initializeQuestionsForms();
    });
  }

  addQuestionToBlock(block: Block) {
    if ((this.testState?.currentStep ?? 1) > 4) {
      this.toast.show({
        message: 'You cannot add questions after defining answers',
        type: 'warning',
      });
      return;
    }
    const formArray = this.questionsOfBlock[block.id!];

    if (formArray) {
      const newQuestionForm = this.createQuestionForm(block);
      formArray.push(newQuestionForm);
      block.numberOfQuestions = block.numberOfQuestions
        ? block.numberOfQuestions + 1
        : 1;
      this.isQuestionsModified[block.id!] = true;
      console.log('A question has been added to block', block.id);
      console.log(
        'Updated number of questions in block',
        block.numberOfQuestions
      );
    } else {
      console.warn('FormArray not found for the block', block.id);
    }
  }

  removeQuestionFromBlock(blockId: number, index: number) {
    const formArray = this.questionsOfBlock[blockId];

    if (formArray && formArray.length > 1) {
      const controlToRemove = formArray.at(index);
      const removedId = controlToRemove?.get('id')?.value;

      if (removedId) {
        this.questionsToDelete.push(removedId);
      }

      formArray.removeAt(index);
      this.isQuestionsModified[blockId] = true;
    }
  }

  initializeQuestionsForms() {
    this.questionsOfBlock = {};
    const lastQuestionOfTest = this.questions[this.questions.length - 1];
    this.blocks.forEach((block) => {
      const formArray = this.fb.array<FormGroup>([]);
      const blockQuestions = this.questions.filter(
        (q) => q.blockId === block.id
      );

      if (blockQuestions.length > 0) {
        blockQuestions.forEach((question) => {
          formArray.push(this.createQuestionForm(block, question));
        });
      } else {
        for (let i = 0; i < block.numberOfQuestions!; i++) {
          formArray.push(this.createQuestionForm(block));
        }
        this.isQuestionsModified[block.id!] = false;
      }

      this.questionsOfBlock[block.id!] = formArray;
    });
  }

  createQuestionForm(block: Block, question?: Question): FormGroup {
    const form = this.fb.group({
      id: [question?.id ?? null],
      text: [question?.text ?? '', Validators.required],
      imageUrl: [question?.imageUrl ?? ''],
      isActive: [question?.isActive ?? true],
      hasImage: [!!question?.imageUrl],
      isUploadingImage: [false],
      isCloned: [question?.id ? false : true],
      realId: [question?.realId ?? question?.id ?? null],
    });

    if (form.get('hasImage')?.value) {
      form.get('imageUrl')?.setValidators([Validators.required]);
    }
    form.get('imageUrl')?.updateValueAndValidity();
    return form;
  }

  getQuestionsFormsForBlock(blockId: number): FormArray<FormGroup> {
    return this.questionsOfBlock[blockId];
  }

  trackByQuestion(index: number, questionForm: FormGroup): any {
    return questionForm.get('id')?.value ?? index;
  }

  async onImageSelected(event: Event, blockId: number, questionIndex: number) {
    const questionForm =
      this.getQuestionsFormsForBlock(blockId).at(questionIndex);
    questionForm.patchValue({ isUploadingImage: true });

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (!this.imagePreviews[blockId]) this.imagePreviews[blockId] = {};
      this.imagePreviews[blockId][questionIndex] = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (this.testId === null) return;

    this.testService.uploadTempImage(file, this.testId).subscribe({
      next: (data) => {
        console.log('Image upload response:', data);
        questionForm.patchValue({
          imageUrl: data.imageUrl,
          isUploadingImage: false,
          hasImage: true,
        });
        console.log('Form after patching imageUrl:', questionForm.value);
      },
      error: (err) => {
        console.error('Image upload failed:', err);
        questionForm.patchValue({
          isUploadingImage: false,
          hasImage: false,
        });
      },
    });
  }

  async saveAllQuestions(newQuestions?: Question[]) {
    if (!this.testId) {
      console.error('Missing testId');
      return;
    }

    let payload: Question[] = [];

    if (newQuestions) {
      payload = newQuestions;
      console.log('New questions to save:', payload);
      for (const block of this.blocks) {
        const relatedQuestions = newQuestions.filter(
          (q) => q.blockId === block.id
        );
        const currentFormArray = this.questionsOfBlock[block.id!];

        if (relatedQuestions.length > 0) {
          block.numberOfQuestions = currentFormArray.length;

          try {
            const updatedBlock = await firstValueFrom(
              this.testService.updateBlock(this.testId!, block.id!, block)
            );
            console.log('Block updated:', updatedBlock);
          } catch (err) {
            console.error('Failed to update block:', err);
          }
        }
      }
    } else {
      for (const [blockId, formArray] of Object.entries(
        this.questionsOfBlock
      )) {
        const block = this.blocks.find((b) => b.id === +blockId)!;

        block.numberOfQuestions = formArray.length;

        for (const form of formArray.controls) {
          const value = form.value;
          payload.push({
            text: value.text,
            imageUrl: value.imageUrl || null,
            isActive: value.isActive,
            blockId: block.id!,
          });
        }
      }

      for (const block of this.blocks) {
        try {
          const updatedBlock = await firstValueFrom(
            this.testService.updateBlock(this.testId!, block.id!, block)
          );
          console.log('Block updated:', updatedBlock);
        } catch (err) {
          console.error('Failed to update block:', err);
        }
      }
    }

    try {
      console.log('Final payload to saveQuestionsBatch:', JSON.stringify(payload, null, 2));

      const response = await firstValueFrom(
        this.testService.saveQuestionsBatch(this.testId, payload)
      );
      this.resourceService.triggerRefresh();
    } catch (error) {
      console.error('Error saving questions:', error);
    }
  }

  async updateQuestions() {
    if (!this.testId) {
      console.error('Missing testId');
      return;
    }

    const payloadToUpdate: Question[] = [];
    const payloadToCreate: Question[] = [];

    for (const [blockIdStr, formArray] of Object.entries(
      this.questionsOfBlock
    )) {
      const blockId = +blockIdStr;
      const block = this.blocks.find((b) => b.id === blockId)!;

      block.numberOfQuestions = formArray.length;

      for (const form of formArray.controls) {
        const value = form.value;
        const questionData: Question = {
          text: value.text,
          imageUrl: value.imageUrl || null,
          isActive: value.isActive,
          blockId: blockId,
        };

        if (value.id && !value.isCloned) {
          console.log(
            'Updating question',
            value.id,
            'with imageUrl:',
            questionData.imageUrl
          );
          questionData.id = value.id;
          payloadToUpdate.push(questionData);
        } else {
          payloadToCreate.push(questionData);
        }
      }
    }

    try {
      if (this.questionsToDelete?.length > 0) {
        await firstValueFrom(
          this.testService.deleteQuestions(this.questionsToDelete)
        );
        console.log('Deleted questions:', this.questionsToDelete);
        this.questionsToDelete = [];
      }
      for (const block of this.blocks) {
        await firstValueFrom(
          this.testService.updateBlock(this.testId, block.id!, block)
        );
        console.log('Block updated:', block);
      }
      if (payloadToUpdate.length > 0) {
        await firstValueFrom(
          this.testService.updateQuestions(this.testId, payloadToUpdate)
        );
        console.log('Questions updated successfully:', payloadToUpdate);
      }
      if (payloadToCreate.length > 0) {
        console.log('Final payload to create:', JSON.stringify(payloadToCreate, null, 2));
        await firstValueFrom(
          this.testService.saveQuestionsBatch(this.testId, payloadToCreate)
        );
        console.log('New questions saved successfully:', payloadToCreate);
      }
      this.resourceService.triggerRefresh();
    } catch (error) {
      console.error('Error in updating questions or blocks:', error);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  hasUnsavedChanges(): boolean {
    for (const formArray of Object.values(this.questionsOfBlock)) {
      for (const form of formArray.controls) {
        if (form.dirty) {
          return true;
        }
      }
    }
    return false;
  }

  async deleteImage(blockId: number, questionIndex: number) {
    console.log(
      'Deleting image for block:',
      blockId,
      'question index:',
      questionIndex
    );

    const questionForm =
      this.getQuestionsFormsForBlock(blockId).at(questionIndex);
    const imageUrl = questionForm.get('imageUrl')?.value;
    const questionId = questionForm.get('id')?.value;

    if (!imageUrl) return;

    const isTemp = imageUrl.includes('tmp/');

    if (!isTemp && questionId) {
      this.testService.deleteImage(imageUrl, questionId).subscribe(
        (res) => console.log('Deleted from server & DB:', res),
        (err) => console.error('Error deleting:', err)
      );
    }

    questionForm.patchValue({
      imageUrl: '',
      hasImage: false,
      isUploadingImage: false,
    });

    if (this.imagePreviews[blockId]?.[questionIndex]) {
      const updated = { ...this.imagePreviews[blockId] };
      delete updated[questionIndex];
      this.imagePreviews[blockId] = { ...updated };
    }
    this.onToggleHasImage(blockId, questionIndex);
    console.log('Image removed from form and previews.');
  }

  zoomedImageUrl: string | null = null;

  openImageZoom(url: string) {
    this.zoomedImageUrl = url;
  }

  closeZoom() {
    this.zoomedImageUrl = null;
  }

  onToggleHasImage(blockId: number, questionIndex: number) {
    const form = this.getQuestionsFormsForBlock(blockId).at(questionIndex);
    const hasImage = form.get('hasImage')?.value;
    const imageUrlControl = form.get('imageUrl');

    if (!hasImage) {
      form.patchValue({
        imageUrl: '',
        isUploadingImage: false,
      });

      if (this.imagePreviews[blockId]?.[questionIndex]) {
        delete this.imagePreviews[blockId][questionIndex];
      }
    }
    if (hasImage) {
      imageUrlControl?.setValidators([Validators.required]);
      imageUrlControl?.markAsTouched();
    } else {
      imageUrlControl?.clearValidators();
      imageUrlControl?.setValue('');
    }

    imageUrlControl?.updateValueAndValidity();
  }

  confirmNavigationVisible = false;
  confirmNavigationMessage =
    'Are you sure you want to proceed? All unsaved changes will be lost';
  pendingStep: number | null = null;

  async saveTest(): Promise<void> {
    if (!this.testState) return;

    if (this.hasInvalidQuestions()) {
      this.toast.show({
        message: 'Please fill in all required fields for questions',
        type: 'warning',
      });
      this.markAllQuestionsAsTouched();
      return;
    }

    if (!this.questions || this.questions.length === 0) {
      this.markAllQuestionsAsTouched();
      await this.saveAllQuestions();
      this.toast.show({
        message: 'Questions saved successfully',
        type: 'success',
      });
      this.markAllQuestionsAsPristine();
      this.resourceService.triggerRefresh();
    } else {
      this.updateQuestions();
      this.toast.show({
        message: 'Questions updated successfully',
        type: 'success',
      });
      this.markAllQuestionsAsPristine();
      this.resourceService.triggerRefresh();
    }

    let targetState = this.testState;
    if (this.testState.currentStep < 4) {
      this.testState.currentStep = 4;
      targetState = await firstValueFrom(
        this.testService.updateTestStateStep(this.testId!, this.testState)
      );
      await firstValueFrom(
        this.testContextService.loadContextIfNeeded(
          this.testId!,
          'edit',
          4,
          true
        )
      );
      this.router.navigate(['/test-questions/edit', this.testId]);
    }
  }

  navigate() {
    console.log('Has invalid questions:', this.hasInvalidQuestions());
    const unsaved = this.hasUnsavedChanges() || this.hasInvalidQuestions();
    console.log('Unsaved changes:', unsaved);
    if (unsaved && this.mode === 'edit') {
      this.pendingStep = (this.testState?.currentStep ?? 1) + 1;
      this.confirmNavigationVisible = true;
      return;
    }

    if (unsaved) {
      this.toast.show({
        message: 'Please save changes before proceeding',
        type: 'warning',
      });
      return;
    }

    this.toast.show({ message: 'Going to next step...', type: 'info' });

    setTimeout(() => {
      const route =
        this.testState?.currentStep === 4
          ? ['/test-answers/new']
          : ['/test-answers/edit', this.testId];
      this.router.navigate(route);
    }, 700);
  }

  onStepSelected(step: number): void {
    if (this.hasUnsavedChanges()) {
      this.pendingStep = step;
      this.confirmNavigationVisible = true;
      return;
    }

    this.navigateToStep(step);
  }

  onConfirmNavigation(): void {
    if (this.pendingStep !== null) {
      this.navigateToStep(this.pendingStep);
    }
    this.resetNavigationState();
  }

  navigateToStep(step: number): void {
    const id = this.testId || this.sessionStorage.getTestId();
    const currentStep = this.testState?.currentStep ?? 1;

    if (!id || !stepRoutes[step]) return;

    const isForward = step > currentStep;
    const route = isForward ? stepRoutesNew[step]() : stepRoutes[step](id);

    this.router.navigate(route);
  }

  resetNavigationState(): void {
    this.confirmNavigationVisible = false;
    this.pendingStep = null;
  }

  onCancelNavigation(): void {
    this.resetNavigationState();
  }

  hasInvalidQuestions(): boolean {
    for (const formArray of Object.values(this.questionsOfBlock)) {
      for (const form of formArray.controls) {
        if (form.invalid) {
          return true;
        }
      }
    }
    return false;
  }

  getError(
    field: string,
    blockId: number,
    questionIndex: number
  ): string | null {
    const formArray = this.getQuestionsFormsForBlock(blockId);
    if (!formArray || questionIndex >= formArray.length) return null;

    const control = formArray.at(questionIndex)?.get(field);
    return control && control.touched
      ? this.validationService.getErrorMessage(control, field)
      : null;
  }

  markAllQuestionsAsTouched() {
    for (const formArray of Object.values(this.questionsOfBlock)) {
      for (const form of formArray.controls) {
        form.markAllAsTouched();
      }
    }

    setTimeout(() => {
      for (const ref of this.questionRefs.toArray()) {
        const el = ref.nativeElement as HTMLElement;

        if (el.querySelector('.ng-invalid')) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-red-400');

          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-red-400');
          }, 2000);

          break;
        }
      }
    }, 0);
  }

  handleQuestionSelection(question: Question) {
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      const formArray = this.questionsOfBlock[block.id!];

      if (!formArray || formArray.length === 0) continue;

      const emptyForm = formArray.controls.find(
        (ctrl) => !ctrl.get('text')?.value?.trim()
      );

      if (emptyForm) {
        emptyForm.patchValue({
          text: question.text,
          isActive: true,
          imageUrl: question.imageUrl || '',
          hasImage: !!question.imageUrl,
        });
        return;
      }
    }
    console.warn('All blocks are full, cannot add question:', question.text);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, blockId: number, formIndex: number) {
    event.preventDefault();
    const raw = event.dataTransfer?.getData('application/json');
    if (!raw) return;

    const droppedQuestion: Question = JSON.parse(raw);
    const formArray = this.questionsOfBlock[blockId];
    const form = formArray?.at(formIndex);
    if (!form) return;

    const existingId = form.get('id')?.value;
    const existingText = form.get('text')?.value?.trim();
    const existingImage = form.get('imageUrl')?.value;
    const existingHasImage = form.get('hasImage')?.value;
    const existingRealId = form.get('realId')?.value;

    const isOccupied = !!existingText || !!existingImage;

    if (isOccupied && this.isEditMode) {
      console.warn('Replacing existing question:', existingText);
      const existingQuestion: Question = {
        id: existingId,
        realId: existingRealId,
        text: existingText,
        imageUrl: existingImage || '',
        isActive: true,
        hasImage: !!existingImage || existingHasImage,
        blockId: blockId,
      };
      this.selectorComponent?.restoreQuestion(existingQuestion);
    }

    form.patchValue({
      id: existingId ?? null,
      realId: droppedQuestion.id,
      text: droppedQuestion.text,
      imageUrl: droppedQuestion.imageUrl || '',
      isActive: true,
      hasImage: !!droppedQuestion.imageUrl,
      isCloned: form.get('id')?.value ? false : true,
    });

    this.selectorComponent?.removeQuestion?.(droppedQuestion.id!);
  }

  showSelector = false;

  toggleSelector() {
    this.showSelector = !this.showSelector;
  }

  onQuestionEdit(blockId: number, index: number) {
    const form = this.questionsOfBlock[blockId]?.at(index);
    if (!form) return;

    const realId = form.get('realId')?.value;
    if (!realId) return;

    const editedQuestion: Question = {
      id: undefined,
      text: form.get('text')?.value,
      imageUrl: form.get('imageUrl')?.value || '',
      isActive: form.get('isActive')?.value,
      blockId: 0,
      realId: realId,
    };

    this.selectorComponent?.restoreQuestion(editedQuestion);
    form.patchValue({ realId: null });
  }

  get completedStepsArray(): number[] {
    if (!this.testState || !this.testState.currentStep) {
      return [];
    }

    return Array.from({ length: this.testState.currentStep }, (_, i) => i + 1);
  }

  confirmDialogVisible = false;
  confirmDialogMessage = 'Are you sure you want to delete this question?';

  pendingDeleteBlockId: number | null = null;
  pendingDeleteQuestionIndex: number | null = null;

  askDeleteConfirmation(blockId: number, index: number) {
    if ((this.testState?.currentStep ?? 1) > 4) {
      this.toast.show({
        message: 'You cannot delete questions after defining answers',
        type: 'warning',
      });
      return;
    }
    this.pendingDeleteBlockId = blockId;
    this.pendingDeleteQuestionIndex = index;
    this.confirmDialogVisible = true;
  }

  onConfirmDelete() {

    if (
      this.pendingDeleteBlockId !== null &&
      this.pendingDeleteQuestionIndex !== null
    ) {
      this.removeQuestionFromBlock(
        this.pendingDeleteBlockId,
        this.pendingDeleteQuestionIndex
      );
      this.toast.show({
        message: 'Question deleted successfully',
        type: 'success',
      });
    }
    this.resetDeleteState();
  }

  onCancelDelete() {
    this.resetDeleteState();
  }

  resetDeleteState() {
    this.confirmDialogVisible = false;
    this.pendingDeleteBlockId = null;
    this.pendingDeleteQuestionIndex = null;
  }

  @ViewChildren('questionRef') questionRefs!: QueryList<ElementRef>;

  markAllQuestionsAsPristine(): void {
    for (const formArray of Object.values(this.questionsOfBlock)) {
      for (const form of formArray.controls) {
        form.markAsPristine();
        form.markAsUntouched();
        Object.values(form.controls).forEach(control => {
          control.markAsPristine();
          control.markAsUntouched();
        });
      }
    }
  }

}
