import {
  Component,
  effect,
  ElementRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  NgModel,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
//import { CacheService } from '../../services/cache.service';
import { TestService } from '../../services/test.service';
import { ResourceService } from '../../services/resource.service';
import {
  Answer,
  Block,
  Question,
  Scale,
  Weight,
} from '../../interfaces/test.interface';
import { firstValueFrom, take } from 'rxjs';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { ValidationService } from '../../services/validation.service';
import { ToastService } from '../../services/toast.service';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { stepRoutes, stepRoutesNew } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { StepRedirectService } from '../../services/step-redirect.service';

@Component({
  selector: 'app-test-weights',
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgClass,
    NgFor,
    ProgressBarComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './test-weights.component.html',
  styleUrl: './test-weights.component.css',
})
export class TestWeightsComponent {
  router = inject(Router);
  route = inject(ActivatedRoute);
  testService = inject(TestService);
  //cacheService = inject(CacheService);
  sessionStorage = inject(SessionStorageService);
  resourceService = inject(ResourceService);
  validationService = inject(ValidationService);
  fb = inject(FormBuilder);
  toast = inject(ToastService);
  step = 6;
  testContextService = inject(TestContextService);
  stepRedirectService = inject(StepRedirectService);

  blocks: Block[] = [];
  scales: Scale[] = [];
  questions: Question[] = [];
  answers: Answer[] = [];
  weights: Weight[] = [];
  mode: string = '';
  testId: number | null = null;
  testState: any = null;

  weightsPerScale: {
    [blockId: number]: {
      [scaleId: number]: {
        [answerId: number]: FormGroup<{
          value: FormControl<number | null>;
          id: FormControl<number | null>;
        }>;
      };
    };
  } = {};

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
          6,
          (id) => ['/test-weights/edit', id]
        );
      if (redirected) return;
    }

    if (!id) {
      console.warn('[TestWeightsComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.sessionStorage.setTestId(id);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    await firstValueFrom(
      this.testContextService.ensureContext(this.testId, this.mode, 6)
    );

    this.testContextService.getTest().subscribe((test) => {
      this.testState = test?.state ?? null;
      console.log(
        '[TestWeightsComponent] Test state loaded:',
        this.testState.currentStep
      );
    });

    this.testContextService.getBlocks().subscribe((blocks) => {
      this.blocks = blocks || [];
    });

    this.testContextService.getScales().subscribe((scales) => {
      this.scales = scales || [];
    });

    this.testContextService.getQuestions().subscribe((questions) => {
      this.questions = questions || [];
    });

    this.testContextService.getAnswers().subscribe((answers) => {
      this.answers = answers || [];
      this.initializeWeightsForms();
    });

    this.testContextService.getWeights().subscribe((weights) => {
      this.weights = weights || [];
      this.patchWeightsToForm(this.weights);
      if (this.weightsAreLocked) {
        this.disableAllWeightControls();
      }
    });
  }

  get completedStepsArray(): number[] {
    const currentStep = this.testState?.currentStep ?? 0;
    return Array.from({ length: currentStep }, (_, i) => i + 1);
  }

  questionGroups: {
    [blockId: number]: { [questionId: number]: FormGroup };
  } = {};

  initializeWeightsForms(): void {
    this.weightsPerScale = {};
    this.questionGroups = {};

    for (const block of this.blocks) {
      const blockId = block.id!;
      this.weightsPerScale[blockId] = {};
      this.questionGroups[blockId] = {};

      const blockScales = this.scales.filter((s) => s.blockId === blockId);
      const blockQuestions = this.getQuestionsByBlock(blockId);

      for (const scale of blockScales) {
        const scaleId = scale.id!;
        this.weightsPerScale[blockId][scaleId] = {};

        for (const question of blockQuestions) {
          for (const answer of this.answers.filter(
            (a) => a.questionId === question.id
          )) {
            const answerId = answer.id!;
            this.weightsPerScale[blockId][scaleId][answerId] = this.fb.group<{
              value: FormControl<number | null>;
              id: FormControl<number | null>;
            }>({
              value: new FormControl<number | null>(0),
              id: new FormControl<number | null>(null),
            });
          }
        }
      }
    }
  }

  getBlockQuestionType(block: Block): string {
    return block.questionsType;
  }

  patchWeightsToForm(weights: any[]): void {
    for (const rawWeight of weights) {
      const scaleId = +(rawWeight.scaleId ?? rawWeight.scale_id);
      const answerId = +(rawWeight.answerId ?? rawWeight.answer_id);
      const value = rawWeight.value;
      const id = rawWeight.id;

      let patched = false;

      for (const blockId of Object.keys(this.weightsPerScale)) {
        const answerGroups = this.weightsPerScale[+blockId]?.[scaleId];

        if (answerGroups?.[answerId]) {
          answerGroups[answerId].patchValue({
            value: value,
            id: id ?? null,
          });
          patched = true;
          break;
        }
      }

      if (!patched) {
        console.warn(
          `Could not patch weight: scaleId=${scaleId}, answerId=${answerId}, value=${value}`
        );
      }
    }
  }

  onBipolarCheck(
    blockId: number,
    scaleId: number,
    answerId: number,
    value: -1 | 1
  ): void {
    const group = this.getWeightControl(blockId, scaleId, answerId);
    const current = group.get('value')?.value;
    group.get('value')?.setValue(current === value ? 0 : value);
    group.markAsTouched();
  }

  onExclusiveCheck(
    blockId: number,
    scaleId: number,
    questionId: number,
    selectedAnswerId: number,
    checked: boolean,
    value: -1 | 1
  ): void {
    const answersForQuestion = this.answers.filter(
      (a) => a.questionId === questionId
    );
    const block = this.blocks.find((b) => b.id === blockId);
    const scale = this.getScalesForBlock(blockId).find((s) => s.id === scaleId);
    if (!block || !scale) return;

    const isSingle = block.questionsType === 'single-choice';
    const isBipolar = scale.scaleType === 'bipolar';

    for (const answer of answersForQuestion) {
      const ctrl = this.getWeightControl(blockId, scaleId, answer.id!);
      const currentValue = ctrl.get('value')?.value;

      if (answer.id === selectedAnswerId) {
        if (currentValue === value) {
          ctrl.get('value')?.setValue(0);
        } else {
          ctrl.get('value')?.setValue(value);
        }
      } else if (isSingle) {
        if (!isBipolar) {
          if (ctrl.get('value')?.value === 1) {
            ctrl.get('value')?.setValue(0);
          }
        } else {
          if (
            ctrl.get('value')?.value === -1 ||
            ctrl.get('value')?.value === 1
          ) {
            ctrl.get('value')?.setValue(0);
          }
        }
      }

      ctrl.markAsTouched();
    }
  }

  getWeightControl(
    blockId: number,
    scaleId: number,
    answerId: number
  ): FormGroup {
    const group = this.weightsPerScale[blockId]?.[scaleId]?.[answerId];
    if (!group) {
      throw new Error(
        `Control not found for block ${blockId} / scale ${scaleId} / answer ${answerId}`
      );
    }
    return group;
  }

  getValueControl(
    blockId: number,
    scaleId: number,
    answerId: number
  ): FormControl<number | null> {
    return this.weightsPerScale[blockId][scaleId][answerId].get(
      'value'
    ) as FormControl<number | null>;
  }

  getScalesForBlock(blockId: number): Scale[] {
    return this.scales.filter((s) => s.blockId === blockId);
  }

  getQuestionsByBlock(blockId: number): Question[] {
    return this.questions.filter((q) => q.blockId === blockId);
  }

  getAnswersForQuestion(questionId: number): Answer[] {
    return this.answers.filter((a) => a.questionId === questionId);
  }

  collectWeights(includeZeros = false): {
    id?: number;
    answerId: number;
    scaleId: number;
    value: number;
  }[] {
    const result: {
      id?: number;
      answerId: number;
      scaleId: number;
      value: number;
    }[] = [];

    for (const [blockId, scaleMap] of Object.entries(this.weightsPerScale)) {
      for (const [scaleId, answersMap] of Object.entries(scaleMap)) {
        for (const [answerId, group] of Object.entries(answersMap)) {
          const value = group.get('value')?.value ?? 0;
          const id = group.get('id')?.value;

          if (includeZeros || value !== 0 || id !== null) {
            result.push({
              id: id ?? undefined,
              answerId: +answerId,
              scaleId: +scaleId,
              value: value,
            });
          }
        }
      }
    }

    return result;
  }

  async saveWeights(): Promise<void> {
    const validation = this.validateAllQuestions();

    if (!validation.isValid) {
      if (validation.reason === 'questions') {
        this.toast.show({
          message: 'Please fill in all required questions before saving',
          type: 'error',
        });
        if (validation.firstInvalidQuestionId !== undefined) {
          setTimeout(
            () => this.scrollToQuestion(validation.firstInvalidQuestionId!),
            0
          );
        }
      } else if (validation.reason === 'scales') {
        const scaleNames = validation.emptyScales?.join(', ') ?? '';
        this.toast.show({
          message: `The following scales have no weights assigned: ${scaleNames}`,
          type: 'warning',
        });
      }
      return;
    }

    const collected = this.collectWeights(true);
    const toCreate = collected.filter((w) => w.id === undefined);
    const toUpdate = collected.filter((w) => w.id !== undefined);

    try {
      if (toCreate.length > 0) {
        await firstValueFrom(this.testService.saveWeightsBatch(toCreate));
        this.toast.show({
          message: 'Weights saved successfully',
          type: 'success',
        });
        this.markAllControlsPristine();
        console.log('[DEBUG] После сохранения:', this.hasUnsavedChanges());
      }

      if (toUpdate.length > 0) {
        await firstValueFrom(this.testService.updateWeightsBatch(toUpdate));
        this.toast.show({
          message: 'Weights updated successfully',
          type: 'success',
        });
        this.markAllControlsPristine();
        console.log('[DEBUG] После сохранения:', this.hasUnsavedChanges());
      }
    } catch (error) {
      console.error('Error saving/updating weights:', error);
      this.toast.show({ message: 'Failed to save weights', type: 'error' });
      return;
    }

    if (this.testState && this.testState.currentStep < 6) {
      this.testState.currentStep = 6;
      this.testState = await firstValueFrom(
        this.testService.updateTestStateStep(this.testId!, this.testState)
      );
      console.log('Test state updated to step 6:', this.testState);
      await firstValueFrom(
        this.testContextService.loadContextIfNeeded(
          this.testId!,
          'edit',
          6,
          true
        )
      );
      this.router.navigate(['/test-weights/edit', this.testId]);
    }

    this.resourceService.triggerRefresh();
  }

  hasUnsavedChanges(): boolean {
    for (const block of this.blocks) {
      const questions = this.getQuestionsByBlock(block.id!);
      for (const question of questions) {
        if (this.isQuestionTouched(block.id!, question.id!)) {
          return true;
        }
      }
    }
    return false;
  }

  markAllControlsPristine(): void {
    for (const block of Object.values(this.weightsPerScale)) {
      for (const scale of Object.values(block)) {
        for (const group of Object.values(scale)) {
          group.markAsPristine();
          group.markAsUntouched();

          for (const control of Object.values(group.controls)) {
            control.markAsPristine();
            control.markAsUntouched();
          }
        }
      }
    }
  }

  confirmNavigationVisible = false;
  confirmNavigationMessage =
    'Are you sure you want to proceed? All unsaved changes will be lost';
  pendingStep: number | null = null;

  navigate(): void {
    console.log(
      '🧭 currentStep =',
      this.testState?.currentStep,
      'mode =',
      this.mode
    );
    console.log('Navigating to next step...', this.hasUnsavedChanges());
    if (this.hasUnsavedChanges() && this.mode === 'edit') {
      this.pendingStep = (this.testState?.currentStep ?? 1) + 1;
      this.confirmNavigationVisible = true;
      return;
    }

    if (this.hasUnsavedChanges() && this.mode === 'new') {
      this.toast.show({
        message: 'Please save changes before proceeding',
        type: 'warning',
      });
      return;
    }

    const validation = this.validateAllQuestions();

    if (!validation.isValid) {
      this.toast.show({
        message: 'Please fill all required fields before proceeding',
        type: 'warning',
      });
      return;
    }

    this.toast.show({ message: 'Going to next step...', type: 'info' });

    setTimeout(() => {
      console.log(
        '[navigate()] actual currentStep =',
        this.testState?.currentStep,
        'mode =',
        this.mode
      );
      const route =
        this.testState?.currentStep === 6
          ? ['/test-norms/new']
          : ['/test-norms/edit', this.testId];
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

  getNumberOfAnswersForBlock(blockId: number): number[] {
    const block = this.blocks.find((b) => b.id === blockId);
    if (!block || !block.numberOfAnswers || block.numberOfAnswers < 1)
      return [];
    return Array.from({ length: block.numberOfAnswers }, (_, i) => i);
  }

  isGradualScaleValid(
    blockId: number,
    questionId: number,
    scaleId: number
  ): boolean {
    const answers = this.getAnswersForQuestion(questionId);
    const values = answers
      .map(
        (answer) =>
          this.getWeightControl(blockId, scaleId, answer.id!)?.get('value')
            ?.value
      )
      .filter((v) => v !== 0);

    const uniqueValues = new Set(values);
    return values.length === uniqueValues.size;
  }

  isGradualScaleFullyFilled(
    blockId: number,
    questionId: number,
    scaleId: number
  ): boolean {
    const answers = this.getAnswersForQuestion(questionId);

    const result = answers.every((answer) => {
      const control = this.getWeightControl(blockId, scaleId, answer.id!);
      const raw = control?.get('value')?.value;
      const value = Number(raw);

      console.log(
        `Answer ${answer.id}: raw="${raw}", parsed=${value}, valid=${
          !isNaN(value) && value > 0
        }`
      );

      return !isNaN(value) && value > 0;
    });
    console.groupEnd();

    return result;
  }

  isGradualScaleUnique(
    blockId: number,
    questionId: number,
    scaleId: number
  ): boolean {
    const answers = this.getAnswersForQuestion(questionId);
    const values = answers
      .map(
        (answer) =>
          +this.getWeightControl(blockId, scaleId, answer.id!).get('value')! ||
          0
      )
      .filter((v) => v !== 0);

    const unique = new Set(values);
    return unique.size === values.length;
  }

  onSelectChange(
    event: Event,
    blockId: number,
    scaleId: number,
    answerId: number
  ): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    const control = this.getWeightControl(blockId, scaleId, answerId);
    const answer = this.answers.find((a) => a.id === answerId);
    const scale = this.scales.find((s) => s.id === scaleId);
    if (!answer || !scale) return;

    const question = this.questions.find((q) => q.id === answer.questionId);
    const block = this.blocks.find((b) => b.id === blockId);
    if (!question || !block) return;

    if (scale.scaleType === 'gradual') {
      if (value !== 0) {
        this.enforceGradualExclusivity(blockId, question.id!, scaleId);
      }
    } else {
      if (block.questionsType === 'single-choice' && value !== 0) {
        this.enforceSingleChoiceAllScales(
          blockId,
          question.id!,
          answerId,
          scaleId
        );
      }
    }

    control.get('value')?.setValue(value);
    control.markAsTouched();
    if (this.isQuestionFullyTouched(blockId, question.id!)) {
      if (!this.shownQuestions.includes(question.id!)) {
        this.shownQuestions.push(question.id!);
      }
      this.updateValidation(blockId, question.id!);
    }
  }

  onCheckboxChange(
    event: Event,
    blockId: number,
    scaleId: number,
    answerId: number
  ): void {
    const checked = (event.target as HTMLInputElement).checked;
    const control = this.getWeightControl(blockId, scaleId, answerId);
    const answer = this.answers.find((a) => a.id === answerId);
    const scale = this.scales.find((s) => s.id === scaleId);
    if (!answer) return;

    const question = this.questions.find((q) => q.id === answer.questionId);
    const block = this.blocks.find((b) => b.id === blockId);

    if (scale?.scaleType === 'gradual' && checked && question) {
      this.enforceGradualExclusivity(blockId, question.id!, scaleId);
    }
    if (block?.questionsType === 'single-choice' && checked && question) {
      this.enforceSingleChoiceAllScales(
        blockId,
        question.id!,
        answerId,
        scaleId
      );
    }

    control.get('value')?.setValue(checked ? 1 : 0);
    control.markAsTouched();
    if (this.isQuestionFullyTouched(blockId, question!.id!)) {
      if (!this.shownQuestions.includes(question!.id!)) {
        this.shownQuestions.push(question!.id!);
      }
      this.updateValidation(blockId, question!.id!);
    }
  }

  enforceGradualExclusivity(
    blockId: number,
    questionId: number,
    selectedScaleId: number
  ): void {
    const answers = this.getAnswersForQuestion(questionId);
    const scales = this.getScalesForBlock(blockId);

    for (const answer of answers) {
      for (const scale of scales) {
        if (scale.id === selectedScaleId) continue;

        const control = this.getWeightControl(blockId, scale.id!, answer.id!);
        control.get('value')?.setValue(0);
        control.markAsTouched();
      }
    }
  }

  enforceSingleChoiceAllScales(
    blockId: number,
    questionId: number,
    selectedAnswerId: number,
    selectedScaleId: number
  ): void {
    const answers = this.getAnswersForQuestion(questionId);
    const scales = this.getScalesForBlock(blockId);

    for (const answer of answers) {
      for (const scale of scales) {
        const isCurrent =
          answer.id === selectedAnswerId && scale.id === selectedScaleId;
        if (isCurrent) continue;

        const control = this.getWeightControl(blockId, scale.id!, answer.id!);
        control.get('value')?.setValue(0);
        control.markAsTouched();
      }
    }
  }

  getAllWeightsForQuestion(
    blockId: number,
    questionId: number
  ): {
    answerId: number;
    scaleId: number;
    value: number | null;
  }[] {
    const result: {
      answerId: number;
      scaleId: number;
      value: number | null;
    }[] = [];

    const answers = this.getAnswersForQuestion(questionId);
    const scales = this.getScalesForBlock(blockId);

    for (const answer of answers) {
      for (const scale of scales) {
        const control = this.getWeightControl(blockId, scale.id!, answer.id!);
        const value = control.get('value')?.value ?? 0;
        result.push({
          answerId: answer.id!,
          scaleId: scale.id!,
          value,
        });
      }
    }

    return result;
  }

  invalidQuestions: number[] = [];

  hasAtLeastOneWeight(blockId: number, questionId: number): boolean {
    const answers = this.getAnswersForQuestion(questionId);
    const scales = this.getScalesForBlock(blockId);

    for (const answer of answers) {
      for (const scale of scales) {
        const value =
          this.getWeightControl(blockId, scale.id!, answer.id!).get('value')
            ?.value ?? 0;
        if (value !== 0) {
          return true;
        }
      }
    }

    return false;
  }

  isQuestionTouched(blockId: number, questionId: number): boolean {
    const answers = this.getAnswersForQuestion(questionId);
    const scales = this.getScalesForBlock(blockId);

    for (const answer of answers) {
      for (const scale of scales) {
        const control = this.getWeightControl(blockId, scale.id!, answer.id!);
        if (control.touched) return true;
      }
    }

    return false;
  }

  isQuestionFullyTouched(blockId: number, questionId: number): boolean {
    const answers = this.getAnswersForQuestion(questionId);
    const scales = this.getScalesForBlock(blockId);

    for (const answer of answers) {
      for (const scale of scales) {
        const control = this.getWeightControl(blockId, scale.id!, answer.id!);
        if (!control.touched) return false;
      }
    }

    return true;
  }

  invalidGradualQuestionsNotUnique: number[] = [];
  invalidGradualQuestionsMissingValues: number[] = [];

  validateAllQuestions(): {
    isValid: boolean;
    reason?: 'questions' | 'scales';
    firstInvalidQuestionId?: number;
    emptyScales?: string[];
  } {
    this.invalidQuestions = [];

    for (const block of this.blocks) {
      const blockId = block.id!;
      const questions = this.getQuestionsByBlock(blockId);
      const scales = this.getScalesForBlock(blockId);

      for (const question of questions) {
        const questionId = question.id!;
        const hasWeight = this.hasAtLeastOneWeight(blockId, questionId);

        if (!hasWeight) {
          this.invalidQuestions.push(questionId);
          continue;
        }

        for (const scale of scales) {
          if (scale.scaleType === 'gradual') {
            const isUnique = this.isGradualScaleValid(
              blockId,
              questionId,
              scale.id!
            );
            const isFilled = this.isGradualScaleFullyFilled(
              blockId,
              questionId,
              scale.id!
            );

            if (!isUnique) {
              this.invalidGradualQuestionsNotUnique.push(questionId);
            }
            const isActive = this.isGradualScaleActive(
              blockId,
              questionId,
              scale.id!
            );

            if (isActive && !isFilled) {
              this.invalidGradualQuestionsMissingValues.push(questionId);
            }

            if (isActive && (!isUnique || !isFilled)) {
              this.invalidQuestions.push(questionId);
              break;
            }
          }
        }
      }
    }

    if (this.invalidQuestions.length > 0) {
      return {
        isValid: false,
        reason: 'questions',
        firstInvalidQuestionId: this.invalidQuestions[0],
      };
    }

    const emptyScales = this.getEmptyScales();
    this.emptyScales = emptyScales;
    if (emptyScales.length > 0) {
      return {
        isValid: false,
        reason: 'scales',
        emptyScales: emptyScales,
      };
    }

    return { isValid: true };
  }

  @ViewChildren('questionContainer') questionContainers!: QueryList<
    ElementRef<HTMLElement>
  >;
  scrollToQuestion(questionId: number): void {
    const el = document.querySelector(`[data-question-id="${questionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  hasAnyWeightInScale(blockId: number, scaleId: number): boolean {
    const blockAnswers = this.answers.filter((a) =>
      this.questions.some((q) => q.blockId === blockId && q.id === a.questionId)
    );

    for (const answer of blockAnswers) {
      const value =
        this.getWeightControl(blockId, scaleId, answer.id!).get('value')
          ?.value ?? 0;
      if (value !== 0) return true;
    }

    return false;
  }

  emptyScales: string[] = [];

  getEmptyScales(): string[] {
    const empty: string[] = [];

    for (const block of this.blocks) {
      const blockId = block.id!;
      const scales = this.getScalesForBlock(blockId);

      for (const scale of scales) {
        if (!this.hasAnyWeightInScale(blockId, scale.id!)) {
          empty.push(scale.pole1!);
        }
      }
    }

    return empty;
  }

  generateRange(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  hasInvalidGradualScale(blockId: number, questionId: number): boolean {
    const scales = this.getScalesForBlock(blockId);
    for (const scale of scales) {
      if (scale.scaleType === 'gradual') {
        if (!this.isGradualScaleValid(blockId, questionId, scale.id!)) {
          return true;
        }
      }
    }
    return false;
  }

  hasMissingValuesGradualScale(blockId: number, questionId: number): boolean {
    const scales = this.getScalesForBlock(blockId).filter(
      (scale) => scale.scaleType === 'gradual'
    );

    const relevantScales = scales.filter((scale) => {
      const answers = this.getAnswersForQuestion(questionId);
      return answers.some((answer) => {
        const value = Number(
          this.getWeightControl(blockId, scale.id!, answer.id!)?.get('value')
            ?.value
        );
        return value !== 0;
      });
    });

    return relevantScales.some(
      (scale) => !this.isGradualScaleFullyFilled(blockId, questionId, scale.id!)
    );
  }

  shownQuestions: number[] = [];

  onQuestionFocusOut(
    event: FocusEvent,
    blockId: number,
    questionId: number
  ): void {
    if (!this.shownQuestions.includes(questionId)) {
      this.shownQuestions.push(questionId);
    }
    this.updateValidation(blockId, questionId);
  }

  private updateValidation(blockId: number, questionId: number): void {
    const hasWeight = this.hasAtLeastOneWeight(blockId, questionId);
    const hasGradualMissing = this.hasMissingValuesGradualScale(
      blockId,
      questionId
    );
    const hasGradualDuplicates = this.hasInvalidGradualScale(
      blockId,
      questionId
    );

    this.invalidQuestions = this.invalidQuestions.filter(
      (id) => id !== questionId
    );
    this.invalidGradualQuestionsMissingValues =
      this.invalidGradualQuestionsMissingValues.filter(
        (id) => id !== questionId
      );
    this.invalidGradualQuestionsNotUnique =
      this.invalidGradualQuestionsNotUnique.filter((id) => id !== questionId);

    const shouldShow = this.shownQuestions.includes(questionId);

    if (!hasWeight && shouldShow) this.invalidQuestions.push(questionId);
    if (hasGradualMissing && shouldShow)
      this.invalidGradualQuestionsMissingValues.push(questionId);
    if (hasGradualDuplicates && shouldShow)
      this.invalidGradualQuestionsNotUnique.push(questionId);
  }

  getErrorType(
    questionId: number
  ): 'none' | 'missing' | 'missingValues' | 'notUnique' {
    if (this.invalidGradualQuestionsMissingValues.includes(questionId))
      return 'missingValues';
    if (this.invalidGradualQuestionsNotUnique.includes(questionId))
      return 'notUnique';
    if (this.invalidQuestions.includes(questionId)) return 'missing';
    return 'none';
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

  getContainerWidthClass(): string {
    const maxScalesPerBlock = Math.max(
      ...this.blocks.map((b) => this.getScalesForBlock(b.id!).length)
    );
    return maxScalesPerBlock <= 2 ? 'max-w-[50vw]' : 'max-w-[80vw]';
  }

  private disableAllWeightControls(): void {
    for (const block of Object.values(this.weightsPerScale)) {
      for (const scale of Object.values(block)) {
        for (const group of Object.values(scale)) {
          group.disable({ emitEvent: false });
        }
      }
    }
  }

  get weightsAreLocked(): boolean {
    return (this.testState?.currentStep ?? 1) >= 7;
  }

  isGradualScaleActive(
    blockId: number,
    questionId: number,
    scaleId: number
  ): boolean {
    const answers = this.getAnswersForQuestion(questionId);
    return answers.some((answer) => {
      const val =
        this.getWeightControl(blockId, scaleId, answer.id!)?.get('value')
          ?.value ?? 0;
      return val !== 0;
    });
  }
}
