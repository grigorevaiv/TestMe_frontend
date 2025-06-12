import { Component, computed, inject, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlayTestService } from '../../services/play-test.service';
import { TestService } from '../../../services/test.service';
import { JsonPipe, NgClass } from '@angular/common';
import { ToastService } from '../../../services/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientService } from '../../../services/patient.service';
import { HeaderComponent } from "../header/header.component";
import { User } from '../../../interfaces/test.interface';
import { FooterComponent } from '../footer/footer.component';



@Component({
  selector: 'app-play-test',
  standalone: true,
  imports: [JsonPipe, NgClass, HeaderComponent, FooterComponent],
  templateUrl: './play-test.component.html',
})
export class PlayTestComponent {
  private playTestService = inject(PlayTestService);
  private testService = inject(TestService);
  private route = inject(ActivatedRoute);
  router = inject(Router);
  toast = inject(ToastService);
  patientService = inject(PatientService);

  chartData: { [key: number]: number } = {};

  question = this.playTestService.currentQuestion;
  test = this.playTestService.test;
  testStarted = this.playTestService.testStarted;
  block = this.playTestService.currentBlock;
  blockStarted = this.playTestService.blockStarted;
  testCompleted = this.playTestService.testCompleted;
  timeLeft = this.playTestService.timeLeft;
  resultsSaved = false;
  

  get selectedAnswers(): string[] {
    const q = this.question();
    if (!q) return [];
    return this.playTestService.userAnswers.get(q.id) ?? [];
  }

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.toast.show({ message: 'Missing token', type: 'error' });
      return;
    }

    try {
      const status = await firstValueFrom(this.patientService.checkTokenStatus(token));
      
      if (status.used) {
        this.toast.show({ message: 'You already has completed the test', type: 'info' });
        await this.router.navigate(['/thank-you']);
        return;
      }

      const session = this.playTestService.sessionStorage.getTestSession();
      if (!session) {
        this.toast.show({ message: 'Session not found', type: 'error' });
        await this.router.navigate(['/play-test', token, 'verify']);
        return;
      }

      this.playTestService.init(session);

    } catch (err) {
      console.error('Token check failed:', err);
      this.toast.show({ message: 'Invalid or expired token.', type: 'error' });
      await this.router.navigate(['/']);
    }
  }

  ngAfterViewChecked(): void {
    if (this.testCompleted() && !this.resultsSaved) {
      this.saveResults();
      this.resultsSaved = true;
    }
  }

  startBlock() {
    this.playTestService.blockStarted.set(true);
  }

  startTest() {
    this.playTestService.startTest();
  }
  
  next() {
    if (this.selectedAnswers.length === 0) {
      this.toast.show({message: 'Please select at least one answer', type: 'error'});
      return;
    }
    this.playTestService.saveAnswers(this.question().id, this.selectedAnswers);
    console.log(this.playTestService.userAnswers);
    this.playTestService.nextQuestion();
  }

  prev() {
    this.playTestService.prevQuestion();
  }

  updateSelectedAnswers(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target) return;

    const current = this.selectedAnswers;
    let updated: string[];

    if (target.type === 'checkbox') {
      updated = target.checked
        ? [...current, target.value]
        : current.filter(value => value !== target.value);
    } else if (target.type === 'radio') {
      updated = [target.value];
    } else {
      return;
    }

    this.playTestService.saveAnswers(this.question().id, updated);
  }

  async calculateResults() {
    console.log(this.playTestService.userAnswers);
    const answers = Array.from(this.playTestService.userAnswers.values()).flat();
    const results = await firstValueFrom(this.testService.getTestResults(this.playTestService.testId!, this.playTestService.userId!));
    console.log(results);
  }

async saveResults() {
  const userAnswers = this.playTestService.userAnswers;
  const session = this.playTestService.sessionStorage.getTestSession();
  if (!session) {
    console.error('Нет сессии теста');
    return;
  }
  console.log('Токен для сессии:', session.token);
  const allQuestions = this.playTestService.questionsWithAnswers.map(q => q.id);
  const allWeights = this.playTestService.weights;
  const allAnswers = this.playTestService.answers;

  const completeAnswers: Record<number, string[]> = {};

  for (const questionId of allQuestions) {
    const answerIds = userAnswers.get(questionId);

    if (answerIds?.length) {
      completeAnswers[questionId] = answerIds;
    } else {
      const answersForQuestion = allAnswers.filter(a => a.questionId === questionId);

      const fallbackAnswer = answersForQuestion.find(answer => {
        return allWeights.some(w => w.answerId === answer.id && w.value === 0);
      });

      if (fallbackAnswer) {
        completeAnswers[questionId] = [String(fallbackAnswer.id)];
      } else {
        console.warn(`Нет ответа с весом 0 для вопроса ${questionId}`);
        completeAnswers[questionId] = [];
      }
    }
  }

  const payload = {
    userId: session.userId,
    testId: session.testId,
    answers: completeAnswers,
    token: session.token
  };

  console.log('Payload to send:', payload);

  try {
    const response : any = await firstValueFrom(this.testService.saveTestResults(session.testId, payload));
    this.toast.show({ message: 'Results are successfully saved', type: 'success' });
    const results = response.finalResult;
    console.log('Results saved:', results);
  } catch (error) {
    console.error('Error on saving results', error);
    this.toast.show({ message: 'You have already saved the results', type: 'info' });
  }
}




  blockTimeout = this.playTestService.blockTimeout;

  continueAfterTimeout() {
    this.playTestService.continueAfterTimeout();
  }

  getBlockProgress(blockId: number): number {
    const questions = this.playTestService.questionsByBlock.get(blockId) || [];
    const answered = questions.filter((q:any) => this.playTestService.userAnswers.has(q.id)).length;
    return questions.length > 0 ? answered / questions.length : 0;
  }

  get blockIds(): number[] {
    return Array.from(this.playTestService.questionsByBlock.keys());
  }



}


