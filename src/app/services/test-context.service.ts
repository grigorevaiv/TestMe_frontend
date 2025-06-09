import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { TestService } from './test.service';
import { Test, Block, Scale, Question, Answer, Weight, Norm, Interpretation } from '../interfaces/test.interface';

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

@Injectable({ providedIn: 'root' })
export class TestContextService {
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

  loadContextIfNeeded(testId: number | null, mode: string): Observable<FullTestContext> {
    if (!testId) {
      console.warn('New test, context is empty');
      const emptyContext: FullTestContext = {
        test: null,
        blocks: null,
        scales: null,
        questions: null,
        answers: null,
        weights: null,
        norms: null,
        interpretations: null
      };
      this.context$.next(emptyContext);
      return of(emptyContext);
    }

    return forkJoin({
      test: this.safe(this.testService.getTestById(testId)),
      blocks: this.safe(this.testService.getBlocks(testId)),
      scales: this.safe(this.testService.getScales(testId)),
      questions: this.safe(this.testService.getQuestions(testId)),
      answers: this.safe(this.testService.getAnswers(testId)),
      weights: this.safe(this.testService.getWeights(testId)),
      norms: this.safe(this.testService.getNorms(testId)),
      interpretations: this.safe(this.testService.getInterpretations(testId)),
    }).pipe(
      tap((ctx) => this.context$.next(ctx))
    );
  }

  getContext(): Observable<FullTestContext> {
    return this.context$.asObservable();
  }

  getBlocks(): Observable<Block[] | null> {
    return this.context$.pipe(map(ctx => ctx.blocks));
  }

  getScales(): Observable<Scale[] | null> {
    return this.context$.pipe(map(ctx => ctx.scales));
  }

  getQuestions(): Observable<Question[] | null> {
    return this.context$.pipe(map(ctx => ctx.questions));
  }

  getAnswers(): Observable<Answer[] | null> {
    return this.context$.pipe(map(ctx => ctx.answers));
  }

  getWeights(): Observable<Weight[] | null> {
    return this.context$.pipe(map(ctx => ctx.weights));
  }

  getNorms(): Observable<Norm[] | null> {
    return this.context$.pipe(map(ctx => ctx.norms));
  }

  getInterpretations(): Observable<Interpretation[] | null> {
    return this.context$.pipe(map(ctx => ctx.interpretations));
  }

  getTest(): Observable<Test | null> {
    return this.context$.pipe(map(ctx => ctx.test));
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
      interpretations: null
    });
  }

}

