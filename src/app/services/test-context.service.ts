import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  take,
  tap,
} from 'rxjs';
import { TestService } from './test.service';
import {
  Test,
  Block,
  Scale,
  Question,
  Answer,
  Weight,
  Norm,
  Interpretation,
} from '../interfaces/test.interface';

interface FullTestContext {
  test: Test | null;
  blocks: Block[] | null;
  scales: Scale[] | null;
  questions: Question[] | null;
  answers: Answer[] | null;
  weights: Weight[] | null;
  norms: Norm[] | null;
  interpretations: Interpretation[] | null;
}

type ContextSection = keyof FullTestContext;

@Injectable({ providedIn: 'root' })
export class TestContextService {
  private contextLoaded = false;
  private currentTestId: number | null = null;

  private context$ = new BehaviorSubject<FullTestContext>({
    test: null,
    blocks: null,
    scales: null,
    questions: null,
    answers: null,
    weights: null,
    norms: null,
    interpretations: null,
  });

  constructor(private testService: TestService) {}

  private safe<T>(obs: Observable<T>): Observable<T | null> {
    return obs.pipe(catchError(() => of(null)));
  }

  loadContextIfNeeded(
    testId: number | null,
    mode: string,
    step: number,
    force: boolean = false
  ): Observable<FullTestContext> {
    
    const stepDependencies: Record<number, ContextSection[]> = {
      1: ['test'],
      2: ['test', 'blocks'],
      3: ['test', 'blocks', 'scales'],
      4: ['test', 'blocks', 'questions'],
      5: ['test', 'blocks', 'questions', 'answers'],
      6: ['test', 'blocks', 'scales', 'questions', 'answers', 'weights'],
      7: ['test', 'scales', 'norms', 'weights'],
      8: ['test', 'scales', 'interpretations'],
    };

    const include = stepDependencies[step] ?? ['test'];
    console.log('[TCS] loadContextIfNeeded called with:', {
  testId,
  mode,
  step,
  include,
});

    const defaultEmpty: FullTestContext = {
      test: null,
      blocks: null,
      scales: null,
      questions: null,
      answers: null,
      weights: null,
      norms: null,
      interpretations: null,
    };

    if (!testId) {
      this.context$.next(defaultEmpty);
      this.contextLoaded = true;
      this.currentTestId = null;
      return of(defaultEmpty);
    }

    if (!force && this.currentTestId === testId) {
      return this.getContext().pipe(
        take(1),
        tap((ctx) => {
          const missing = include.some((section) => ctx[section] == null);
          if (!missing) {
            this.contextLoaded = true;
          }
        }),
        map((ctx) => {
          const missing = include.some((section) => ctx[section] == null);
          if (missing) {
            throw new Error('Context incomplete, reload required');
          }
          return ctx;
        }),
        catchError(() => this.loadContextIfNeeded(testId, mode, step, true))
      );
    }

    const loaders: Partial<Record<ContextSection, Observable<any>>> = {
      test: this.testService.getTestById(testId),
      blocks: this.safe(this.testService.getBlocks(testId)),
      scales: this.safe(this.testService.getScales(testId)),
      questions: this.safe(this.testService.getQuestions(testId)),
      answers: this.safe(this.testService.getAnswers(testId)),
      weights: this.safe(this.testService.getWeights(testId)),
      norms: this.safe(this.testService.getNorms(testId)),
      interpretations: this.safe(this.testService.getInterpretations(testId)),
    };

    const selectedLoaders: Partial<Record<ContextSection, Observable<any>>> =
      {};
    for (const key of include) {
      selectedLoaders[key] = loaders[key]!;
    }

    return forkJoin(selectedLoaders).pipe(
      map((partial: Partial<FullTestContext>) => ({
        ...defaultEmpty,
        ...partial,
      })),
      tap((ctx) => {
        this.context$.next(ctx);
        this.contextLoaded = true;
        this.currentTestId = testId;
      })
    );
  }

  ensureContext(
    testId: number | null,
    mode: string,
    step: number
  ): Observable<FullTestContext> {
    console.log(`[TCS] ensureContext called with: testId=${testId}, mode=${mode}, step=${step}`);


    return this.loadContextIfNeeded(testId, mode, step, false);
  }

  getContext(): Observable<FullTestContext> {
    console.log('[TCS] getContext called');
    return this.context$.asObservable();
  }

  getTest(): Observable<Test | null> {
    return this.context$.pipe(map((ctx) => ctx.test));
  }

  getBlocks(): Observable<Block[] | null> {
    return this.context$.pipe(map((ctx) => ctx.blocks));
  }

  getScales(): Observable<Scale[] | null> {
    return this.context$.pipe(map((ctx) => ctx.scales));
  }

  getQuestions(): Observable<Question[] | null> {
    return this.context$.pipe(map((ctx) => ctx.questions));
  }

  getAnswers(): Observable<Answer[] | null> {
    return this.context$.pipe(map((ctx) => ctx.answers));
  }

  getWeights(): Observable<Weight[] | null> {

    return this.context$.pipe(map((ctx) => ctx.weights));
  }

  getNorms(): Observable<Norm[] | null> {
    return this.context$.pipe(map((ctx) => ctx.norms));
  }

  getInterpretations(): Observable<Interpretation[] | null> {
    return this.context$.pipe(map((ctx) => ctx.interpretations));
  }

  getContextSection<K extends ContextSection>(
    key: K
  ): Observable<FullTestContext[K]> {
    return this.context$.pipe(map((ctx) => ctx[key]));
  }

  resetContext(): void {
    this.context$.next({
      test: null,
      blocks: null,
      scales: null,
      questions: null,
      answers: null,
      weights: null,
      norms: null,
      interpretations: null,
    });
    this.contextLoaded = false;
    this.currentTestId = null;
  }
}
