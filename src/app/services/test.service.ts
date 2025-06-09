import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Test, Block, Scale, Question, Answer, Weight, State, Norm, Tag, QuestionWithTags } from '../interfaces/test.interface';

@Injectable({ providedIn: 'root' })
export class TestService {
  constructor() {}

  baseUrl = environment.TESTS_BASE_URL;
  http = inject(HttpClient);

  // Тесты
  getTestData(testId: number): Observable<Test> {
    return this.http.get<Test>(`${this.baseUrl}/${testId}`);
  }

  getTests(): Observable<Test[]> {
    return this.http.get<Test[]>(`${this.baseUrl}`);
  }

  getTestById(testId: number): Observable<Test> {
    return this.http.get<Test>(`${this.baseUrl}/${testId}`);
  }

  addTest(test: Test): Observable<Test> {
    return this.http.post<Test>(`${this.baseUrl}`, test);
  }

  updateTest(testId: number, test: Test): Observable<Test> {
    return this.http.put<Test>(`${this.baseUrl}/${testId}`, test);
  }

  updateTestStateStep(testId: number, state: State): Observable<State> {
    return this.http.put<State>(`${this.baseUrl}/${testId}/states`, state);
  }

  // Блоки
  getBlocks(testId: number): Observable<Block[]> {
    return this.http.get<Block[]>(`${this.baseUrl}/${testId}/blocks`);
  }

  addBlock(testId: number, block: Block): Observable<Block> {
    return this.http.post<Block>(`${this.baseUrl}/${testId}/blocks`, block);
  }

  addBlocksBatch(testId: number, blocks: Block[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/blocks/batch/${testId}`, blocks);
  }

  updateBlock(testId: number, blockId: number, block: Block): Observable<Block> {
    return this.http.put<Block>(`${this.baseUrl}/${testId}/blocks/${blockId}`, block);
  }

  deleteBlock(testId: number, blockId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${testId}/blocks/${blockId}`);
  }

  getAllBlocks(): Observable<Block[]> {
    return this.http.get<Block[]>(`${this.baseUrl}/blocks/all`);
  }

  // Шкалы
  getScales(testId: number): Observable<Scale[]> {
    return this.http.get<Scale[]>(`${this.baseUrl}/${testId}/scales`);
  }

  addScale(testId: number, scale: Scale): Observable<Scale> {
    return this.http.post<Scale>(`${this.baseUrl}/${testId}/scales`, scale);
  }

  addScalesBatch(testId: number, scales: Scale[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/${testId}/scales/batch`, scales);
  }

  updateScale(scaleId: number, scale: Scale): Observable<Scale> {
    return this.http.put<Scale>(`${this.baseUrl}/scales/${scaleId}`, scale);
  }

  deleteScale(scaleId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/scales/${scaleId}`);
  }

  // Вопросы
  getQuestions(testId: number): Observable<Question[]> {
    return this.http.get<Question[]>(`${this.baseUrl}/${testId}/questions`);
  }

  saveQuestionsBatch(testId: number, questions: Question[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/${testId}/questions/batch/`, questions);
  }

  updateQuestions(testId: number, questions: Question[]): Observable<Question[]> {
    return this.http.put<Question[]>(`${this.baseUrl}/${testId}/questions/batch/`, questions);
  }

  deleteQuestions(ids: number[]): Observable<void> {
    return this.http.request<void>('delete', `${this.baseUrl}/questions/batch/`, {
      body: { ids },
    });
  }

  getAllQuestions(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/questions/all`);
  }

  uploadTempImage(file: File, testId: number): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('test_id', testId.toString());

    return this.http.post<{ imageUrl: string }>(
      `${this.baseUrl}/upload-temp-image/`,
      formData
    );
  }

  deleteImage(imageUrl: string, questionId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/delete-image`, {
      body: { imageUrl, questionId }
    });
  }

  // Ответы
  getAnswers(testId: number): Observable<Answer[]> {
    return this.http.get<Answer[]>(`${this.baseUrl}/${testId}/answers`);
  }

  saveAnswersBatch(answers: Answer[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/answers/batch/`, answers);
  }

  updateAnswersBatch(answers: Answer[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/answers/batch/`, answers);
  }


  getWeights(testId: number): Observable<Weight[]> {
    return this.http.get<Weight[]>(`${this.baseUrl}/${testId}/weights`);
  }

  saveWeightsBatch(weights: Weight[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/weights/batch`, weights);
  }

  updateWeightsBatch(weights: Weight[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/weights/batch`, weights);
  }

  // Нормы
  getNorms(testId: number): Observable<Norm[]> {
    return this.http.get<Norm[]>(`${this.baseUrl}/${testId}/norms`);
  }

  addNormsToScales(norms: Norm[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/batch/norms`, norms);
  }

  updateNorms(norms: Norm[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/batch/norms`, norms);
  }

  // Интерпретации
  getInterpretations(testId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${testId}/interpretations`);
  }

  saveInterpretationsBatch(interpretations: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/batch/interpretations`, interpretations);
  }

  updateInterpretationsBatch(interpretations: any[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/batch/interpretations`, interpretations);
  }

  // Теги
  addTag(tag: Tag): Observable<Tag> {
    return this.http.post<Tag>(`${this.baseUrl}/tags`, tag);
  }

  getAllTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.baseUrl}/tags/all`);
  }

  getTestResults(testId: number, userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${testId}/calculate`);
  }

  saveTestResults(testId: number, payload: any) {
    return this.http.post(`${this.baseUrl}/${testId}/save`, payload);
  }

  getLatestUserResult(userId: number, testId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/results/latest`, {
      params: {
        user_id: userId,
        test_id: testId
      }
    });
  }

  getAllResultsByUser(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/results/${userId}`);
  }

}
