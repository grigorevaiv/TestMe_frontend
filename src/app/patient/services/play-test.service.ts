import {
  computed,
  effect,
  EnvironmentInjector,
  inject,
  Injectable,
  Injector,
  ResourceStatus,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ResourceService } from '../../services/resource.service';
import {
  Answer,
  Block,
  Question,
  Test,
  Weight,
} from '../../interfaces/test.interface';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestService } from '../../services/test.service';

@Injectable({
  providedIn: 'root',
})
export class PlayTestService {
  private testService = inject(TestService);

  test: Test = {
    title: '',
    description: '',
    instructions: '',
  };
  questions: Question[] = [];
  answers: Answer[] = [];
  blocks: Block[] = [];
  weights: Weight[] = [];
  questionsWithAnswers: any[] = [];
  sessionStorage = inject(SessionStorageService);

  questionsByBlock = new Map<number, any>();
  userAnswers = new Map<number, string[]>();

  currentQuestionIndex = 0;
  currentBlockIndex = 0;

  currentQuestion = signal<any | null>(null);
  currentBlock = signal<any | null>(null);

  testStarted = signal(false);
  blockStarted = signal(false);
  testCompleted = signal(false);
  testId: number | null = null;
  userId: number | null = null;

  constructor() {
    const session = this.sessionStorage.getTestSession();
    if (!session) {
      console.error('No data of test received, reload page');
      return;
    }

    this.init(session);
  }

  initialized = false;
  async init(sessionInfo: any) {
    this.testId = sessionInfo.testId;
    this.userId = sessionInfo.userId;
    this.sessionStorage.setTestSession(sessionInfo);
    this.sessionStorage.setTestId(sessionInfo.testId);

    if (!this.testId) {
      console.error('No test data received');
      return;
    }
    try {
      const [test, blocks, questions, answers, weights] = await Promise.all([
        firstValueFrom(this.testService.getTestData(this.testId)),
        firstValueFrom(this.testService.getBlocks(this.testId)),
        firstValueFrom(this.testService.getQuestions(this.testId)),
        firstValueFrom(this.testService.getAnswers(this.testId)),
        firstValueFrom(this.testService.getWeights(this.testId)),
      ]);

      this.test.title = test.title;
      this.test.description = test.description;
      this.test.instructions = test.instructions;
      console.log('Test data loaded:', this.test);
      this.blocks = blocks;
      this.questions = questions;
      this.answers = answers;
      this.weights = weights;
      console.log('Weights:', this.weights);

      this.loadTestData();
      this.initialized = true;
    } catch (err) {
      console.error('Error on initializing test data', err);
    }
  }

  shuffleArray<T>(array: T[]): T[] {
    return [...array].sort(() => Math.random() - 0.5);
  }

  async loadTestData() {
    try {
      this.questionsWithAnswers = this.questions.map((question) => {
        const questionAnswers = this.answers.filter(
          (answer) => answer.questionId === question.id
        );

        const block = this.blocks.find((b) => b.id === question.blockId);

        const randomizedAnswers = block?.randomizeAnswers
          ? this.shuffleArray(questionAnswers)
          : questionAnswers;

        return {
          ...question,
          questionAnswers: randomizedAnswers,
        };
      });

      this.questionsByBlock.clear();
      for (const block of this.blocks) {
        const questionsInBlock = this.questionsWithAnswers.filter(
          (q) => q.blockId === block.id
        );

        const randomizedQuestions = block.randomizeQuestions
          ? this.shuffleArray(questionsInBlock)
          : questionsInBlock;

        this.questionsByBlock.set(block.id!, randomizedQuestions);
      }
      const firstBlock = this.blocks[this.currentBlockIndex];
      const firstBlockId = firstBlock?.id;
      const questionsInFirstBlock =
        this.questionsByBlock.get(firstBlockId!) || [];

      this.currentBlock.set(firstBlock);
      this.currentQuestion.set(
        questionsInFirstBlock[this.currentQuestionIndex]
      );
    } catch (error) {
      console.error('Failed to load test data', error);
    }
  }

  nextBlock() {
    this.blockStarted.set(false);
    const numberOfBlocks = this.blocks.length;
    if (this.currentBlockIndex < numberOfBlocks - 1) {
      this.currentBlockIndex++;
      this.currentBlock.set(this.blocks[this.currentBlockIndex]);
      this.startBlock();
      const currentBlockId = Array.from(this.questionsByBlock.keys())[
        this.currentBlockIndex
      ];
      const questionsInBlock = this.questionsByBlock.get(currentBlockId) || [];
      this.currentQuestionIndex = 0;
      this.currentQuestion.set(questionsInBlock[this.currentQuestionIndex]);
      console.log('Current question:', this.currentQuestion());
      this.blockStarted.set(false);
    } else {
      console.log('No more blocks available');
      this.stopTimer();
      this.testCompleted.set(true);
    }
  }

  startTest() {
    this.stopTimer();
    this.testStarted.set(true);
    this.currentBlock.set(this.blocks[this.currentBlockIndex]);
  }

  nextQuestion() {
    const currentBlockId = Array.from(this.questionsByBlock.keys())[
      this.currentBlockIndex
    ];
    const questionsInBlock = this.questionsByBlock.get(currentBlockId) || [];

    if (this.currentQuestionIndex < questionsInBlock.length - 1) {
      this.currentQuestionIndex++;
      this.currentQuestion.set(questionsInBlock[this.currentQuestionIndex]);
    } else {
      this.nextBlock();
    }
  }

  prevQuestion() {
    const currentBlockId = Array.from(this.questionsByBlock.keys())[
      this.currentBlockIndex
    ];
    const questionsInBlock = this.questionsByBlock.get(currentBlockId) || [];

    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.currentQuestion.set(questionsInBlock[this.currentQuestionIndex]);
    }
  }

  saveAnswers(questionId: number, answersId: string[]) {
    this.userAnswers.set(questionId, answersId);
  }

  timeLeft = signal<number | null>(null);

startBlock() {
  this.blockStarted.set(true); // сначала считаем блок начатым

  this.stopTimer(); // затем таймер

  const currentBlock = this.currentBlock();
  if (currentBlock?.hasTimeLimit) {
    this.timeLeft.set(currentBlock.timeLimit * 10);
    this.startTimer();
  }
}

  private startTimer() {
    this.stopTimer();
    this.intervalId = setInterval(() => {
      const current = this.timeLeft();
      if (current !== null && current > 0) {
        this.timeLeft.set(current - 1);
      } else {
        this.stopTimer();
        this.finishBlock();
      }
    }, 1000);
  }

  private intervalId: any = null;

  private finishBlock() {
    this.blockStarted.set(false);
    this.stopTimer();

    this.timeLeft.set(null);
    this.blockTimeout.set(true);

    setTimeout(() => {
      if (this.blockTimeout()) {
        this.continueAfterTimeout();
      }
    }, 10000);
  }

  blockTimeout = signal(false);
  continueAfterTimeout() {
    this.blockTimeout.set(false);

    if (this.currentBlockIndex < this.blocks.length - 1) {
      this.currentBlockIndex++;
      this.currentBlock.set(this.blocks[this.currentBlockIndex]);

      const nextBlockId = this.blocks[this.currentBlockIndex].id!;
      const questionsInBlock = this.questionsByBlock.get(nextBlockId) || [];
      this.currentQuestionIndex = 0;
      this.currentQuestion.set(questionsInBlock[0]);

      this.startBlock();
    } else {
      this.stopTimer();
      this.testCompleted.set(true);
    }
  }

  private stopTimer() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.timeLeft.set(null);
      console.log('Timer stopped');
    }
  }
}
