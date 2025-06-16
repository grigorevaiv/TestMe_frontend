import {
  Component,
  effect,
  ElementRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
//import { CacheService } from '../../services/cache.service';
import { TestService } from '../../services/test.service';
import { Answer, Block, Question } from '../../interfaces/test.interface';
import { ResourceService } from '../../services/resource.service';
import { firstValueFrom } from 'rxjs';
import { ValidationService } from '../../services/validation.service';
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { ToastService } from '../../services/toast.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { stepRoutes, stepRoutesNew } from '../../constants/step-routes';
import { TestContextService } from '../../services/test-context.service';
import { NgIf } from '@angular/common';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { StepRedirectService } from '../../services/step-redirect.service';

@Component({
  selector: 'app-test-answers',
  imports: [
    ReactiveFormsModule,
    SentencecasePipe,
    ProgressBarComponent,
    NgIf,
    ConfirmDialogComponent,
  ],
  templateUrl: './test-answers.component.html',
  styleUrl: './test-answers.component.css',
})
export class TestAnswersComponent {
  private fb = inject(FormBuilder);
  //private cacheService = inject(CacheService);
  private sessionStorage = inject(SessionStorageService);
  private testService = inject(TestService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private validationService = inject(ValidationService);
  private testContextService = inject(TestContextService);
  resourceService = inject(ResourceService);
  toast = inject(ToastService);
  stepRedirectService = inject(StepRedirectService);

  blocks: Block[] = [];
  questions: Question[] = [];
  answers: Answer[] = [];
  mode: string = '';
  testState: any;
  step = 5;
  answersPerQuestion: {
    [blockId: number]: { [questionId: number]: FormArray<FormGroup> };
  } = {};
  testId: number | null = null;

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
          5,
          (id) => ['/test-answers/edit', id]
        );
      if (redirected) return;
    }

    if (!id) {
      console.warn('[TestAnswersComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.sessionStorage.setTestId(id);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    await firstValueFrom(
      this.testContextService.ensureContext(this.testId, this.mode, 5)
    );

    this.testContextService.getTest().subscribe((test) => {
      this.testState = test?.state ?? null;
    });

    this.testContextService.getBlocks().subscribe((blocks) => {
      this.blocks = blocks || [];
    });

    this.testContextService.getQuestions().subscribe((questions) => {
      this.questions = questions || [];
      this.initializeAnswersForms();
    });

    this.testContextService.getAnswers().subscribe((answers) => {
      this.answers = answers || [];
      this.patchAnswersToForm(this.answers);
    });
  }

  initializeAnswersForms() {
    this.answersPerQuestion = {};
    const answersPerBlock: { [blockId: number]: number } = {};
    this.blocks.forEach((block) => {
      answersPerBlock[block.id!] = block.numberOfAnswers ?? 0;
    });

    this.questions.forEach((question) => {
      const blockId = question.blockId ?? 0;
      const questionId = question.id;
      const numberOfAnswers = answersPerBlock[blockId];

      const formArray = this.fb.array<FormGroup>(
        [],
        this.validationService.allAnswersFilledValidator
      );
      for (let i = 0; i < numberOfAnswers; i++) {
        formArray.push(
          this.fb.group({
            id: [null],
            text: ['', Validators.required],
          })
        );
      }

      if (!this.answersPerQuestion[blockId]) {
        this.answersPerQuestion[blockId] = {};
      }

      this.answersPerQuestion[blockId][questionId!] = formArray;
    });
  }

  patchAnswersToForm(answers: Answer[]) {
    for (const answer of answers) {
      const question = this.questions.find((q) => q.id === answer.questionId);
      if (!question) continue;

      const blockId = question.blockId!;
      const questionId = answer.questionId;
      const formArray = this.answersPerQuestion[blockId]?.[questionId];

      if (formArray) {
        const emptyGroup = formArray.controls.find(
          (g) => !g.get('text')?.value
        );
        if (emptyGroup) {
          emptyGroup.patchValue({ id: answer.id, text: answer.text });
        } else {
          formArray.push(
            this.fb.group({
              id: [answer.id],
              text: [answer.text, Validators.required],
            })
          );
        }
      }
    }
  }

  getQuestionsByBlock(blockId: number): Question[] {
    return this.questions.filter((q) => q.blockId === blockId);
  }

  getAnswersFormsForQuestion(
    blockId: number,
    questionId: number
  ): FormArray<FormGroup> {
    return (
      this.answersPerQuestion[blockId]?.[questionId] ??
      this.fb.array<FormGroup>([])
    );
  }

  applyToAllAnswers(blockId: number): void {
    const blockQuestions = this.getQuestionsByBlock(blockId);
    if (!blockQuestions.length) return;

    const firstQuestionId = blockQuestions[0].id!;
    const sourceGroups = this.getAnswersFormsForQuestion(
      blockId,
      firstQuestionId
    ).controls;

    blockQuestions.forEach((question, index) => {
      if (index === 0) return;

      const targetGroups = this.getAnswersFormsForQuestion(
        blockId,
        question.id!
      ).controls;

      sourceGroups.forEach((sourceGroup, i) => {
        const sourceValue = sourceGroup.get('text')?.value;
        const targetGroup = targetGroups[i];
        if (targetGroup && sourceValue !== undefined) {
          targetGroup.patchValue({ text: sourceValue });
        }
      });
    });
  }

  @ViewChildren('answerForm') answerForms!: QueryList<ElementRef<HTMLElement>>;

  confirmNavigationVisible = false;
  confirmNavigationMessage =
    'Are you sure you want to proceed? All unsaved changes will be lost';
  pendingStep: number | null = null;

  async saveTest(): Promise<void> {
    const result: Answer[] = [];
    let firstInvalidScrolled = false;

    for (const [blockIdStr, questionsMap] of Object.entries(
      this.answersPerQuestion
    )) {
      for (const [questionIdStr, formArray] of Object.entries(questionsMap)) {
        const typedArray = formArray as FormArray<FormGroup>;
        const questionId = +questionIdStr;

        typedArray.markAllAsTouched();

        if (typedArray.invalid && !firstInvalidScrolled) {
          const index = this.questions.findIndex(
            (q) => q.id === questionId && q.blockId === +blockIdStr
          );

          setTimeout(() => {
            const target = this.answerForms.get(index);
            const el = target?.nativeElement as HTMLElement;

            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-2', 'ring-red-400');

              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-red-400');
              }, 2000);
            }
          }, 0);

          this.toast?.show?.({
            message: 'Please fill in all answers',
            type: 'warning',
          });

          firstInvalidScrolled = true;
          return;
        }

        typedArray.controls.forEach((group) => {
          const text = group.get('text')?.value?.trim();
          const id = group.get('id')?.value ?? null;

          if (text) {
            result.push({
              text,
              questionId,
              ...(id && { id }),
            });
          }
        });
      }
    }

    if (result.length === 0) {
      this.toast?.show?.({
        message: 'No answers to save',
        type: 'error',
      });
      return;
    }

    try {
      const newAnswers = result.filter((a) => !a.id);
      const existingAnswers = result.filter((a) => !!a.id);

      if (newAnswers.length > 0) {
        const savedAnswers = await firstValueFrom(
          this.testService.saveAnswersBatch(newAnswers)
        );
        this.toast?.show?.({
          message: 'Answers saved successfully',
          type: 'success',
        });
        await firstValueFrom(
          this.testContextService.loadContextIfNeeded(
            this.testId!,
            'edit',
            5,
            true
          )
        );
      }

      if (existingAnswers.length > 0) {
        const updatedAnswers = await firstValueFrom(
          this.testService.updateAnswersBatch(existingAnswers)
        );
        this.toast?.show?.({
          message: 'Answers updated successfully',
          type: 'success',
        });
        await firstValueFrom(
          this.testContextService.loadContextIfNeeded(
            this.testId!,
            'edit',
            5,
            true
          )
        );
      }
    } catch (error) {
      console.error('Failed to save/update answers:', error);
      this.toast?.show?.({
        message: 'Failed to save/update answers',
        type: 'error',
      });
      return;
    }

    if (this.testState?.currentStep < 5 && this.testId) {
      this.testState.currentStep = 5;
      const updatedState = await firstValueFrom(
        this.testService.updateTestStateStep(this.testId, this.testState)
      );
      this.testState = updatedState;
      await firstValueFrom(
        this.testContextService.loadContextIfNeeded(
          this.testId!,
          'edit',
          5,
          true
        )
      );
      this.router.navigate(['/test-answers/edit', this.testId]);
    }
  }

  navigate() {
    const unsaved = this.hasUnsavedChanges();

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
        this.testState?.currentStep === 5
          ? ['/test-weights/new']
          : ['/test-weights/edit', this.testId];
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

  get completedStepsArray(): number[] {
    if (!this.testState || !this.testState.currentStep) {
      return [];
    }
    console.log(
      Array.from({ length: this.testState.currentStep }, (_, i) => i + 1)
    );
    return Array.from({ length: this.testState.currentStep }, (_, i) => i + 1);
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  hasUnsavedChanges(): boolean {
    for (const blockAnswers of Object.values(this.answersPerQuestion)) {
      for (const formArray of Object.values(blockAnswers)) {
        for (const form of formArray.controls) {
          if (form.dirty || form.invalid) {
            return true;
          }
        }
      }
    }
    return false;
  }

  beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
}
