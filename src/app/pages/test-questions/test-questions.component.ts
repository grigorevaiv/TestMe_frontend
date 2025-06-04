import { Component, effect, inject } from '@angular/core';
import { ResourceService } from '../../services/resource.service';
//import { CacheService } from '../../services/cache.service';
import { Block, Question } from '../../interfaces/test.interface';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestService } from '../../services/test.service';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ValidationService } from '../../services/validation.service';
import { ViewChild } from '@angular/core';
import { QuestionSelectorComponent } from "../../components/question-selector/question-selector.component";
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { NgClass } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { stepRoutes } from '../../constants/step-routes';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-test-questions',
  imports: [ReactiveFormsModule, SentencecasePipe, QuestionSelectorComponent, NgClass, ProgressBarComponent, ConfirmDialogComponent],
  templateUrl: './test-questions.component.html',
  styleUrl: './test-questions.component.css'
})

export class TestQuestionsComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  //private cacheService = inject(CacheService);
  private sessionStorage = inject(SessionStorageService);
  private resourceService = inject(ResourceService);
  private validationService = inject(ValidationService);
  testService = inject(TestService);
  toast = inject(ToastService);

  testId: number | null = null;
  testState: any;
  blocks: Block[] = [];
  questions: Question[] = [];
  mode: string = '';
  step: number = 4;
  questionsOfBlock: { [blockId: number]: FormArray<FormGroup> } = {};
  imagePreviews: { [blockId: number]: { [questionIndex: number]: string } } = {};
  isQuestionsModified: { [blockId: number]: boolean } = {};
  questionsToDelete: number[] = [];

  @ViewChild(QuestionSelectorComponent, { static: false })
  selectorComponent?: QuestionSelectorComponent;

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('testId');
    this.mode = this.route.snapshot.paramMap.get('mode') || 'new';

    const id = idParam ? Number(idParam) : this.sessionStorage.getTestId();
    if (id) {
      this.testId = id;
      this.sessionStorage.setTestId(id);
    } else {
      console.warn('❌ [constructor] testId not found in route or session');
    }

    effect(() => {
      const test = this.resourceService.testResource.value();
      if(test) {
        this.testState = test?.state ?? null;
      }
      const blocks = this.resourceService.blocksResource.value();
      const questions = this.resourceService.questionsResource.value();

      console.log('📦 test:', test?.id);
      console.log('📥 blocks:', blocks?.map(b => b.id));
      console.log('❓ questions:', questions?.map(q => q.id));

      
      this.blocks = blocks || [];

      if (questions && questions.length > 0) {
        this.questions = questions;
        console.log('✅ Loaded questions:', this.questions);
        console.log('testId used:', this.testId);
      }

      if (this.blocks.length > 0) {
        this.initializeQuestionsForms(); // 🧠 вызывается строго после blocks
      }
    });

    this.resourceService.triggerRefresh();
  }

  addQuestionToBlock(block: Block) {
    const formArray = this.questionsOfBlock[block.id!];

    if (formArray) {

      const newQuestionForm = this.createQuestionForm(block);
      formArray.push(newQuestionForm);
      block.numberOfQuestions = block.numberOfQuestions ? block.numberOfQuestions + 1 : 1;
      this.isQuestionsModified[block.id!] = true;
      console.log('A question has been added to block', block.id);
      console.log('Updated number of questions in block', block.numberOfQuestions);

    } else {
      console.warn('FormArray not found for the block', block.id);
    }
  }

removeQuestionFromBlock(blockId: number, index: number) {
  const formArray = this.questionsOfBlock[blockId];

  if (formArray && formArray.length > 1) {
    const controlToRemove = formArray.at(index);
    const removedId = controlToRemove?.get('id')?.value;

    console.log('Удаляем вопрос с ID:', removedId);

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
    const blockQuestions = this.questions.filter(q => q.blockId === block.id);

    if (blockQuestions.length > 0) {
      blockQuestions.forEach(question => {
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
      isCloned: [question?.id ? false : true], // если id нет, то клон
      realId: [question?.realId ?? question?.id ?? null]
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
    const questionForm = this.getQuestionsFormsForBlock(blockId).at(questionIndex);
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
      },
      error: (err) => {
        console.error('Image upload failed:', err);
        questionForm.patchValue({
          isUploadingImage: false,
          hasImage: false,
        });
      }
    });
  }


async saveAllQuestions(newQuestions?: Question[]) {
  if (!this.testId) {
    console.error('Missing testId');
    return;
  }

  let payload: Question[] = [];

  // 1. если есть новые вопросы
  if (newQuestions) {
    payload = newQuestions;

    for (const block of this.blocks) {
      const relatedQuestions = newQuestions.filter(q => q.blockId === block.id);
      const currentFormArray = this.questionsOfBlock[block.id!];

      if (relatedQuestions.length > 0) {
        // ориентируемся на количество форм
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
    // если новых вопросов нет, собираем существующие
    for (const [blockId, formArray] of Object.entries(this.questionsOfBlock)) {
      const block = this.blocks.find(b => b.id === +blockId)!;

      // пересчитываем формы
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

    // обновляем блоки
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
    const response = await firstValueFrom(
      this.testService.saveQuestionsBatch(this.testId, payload)
    );
    console.log('Questions saved successfully:', response);
    this.toast.show({ message: 'Questions saved successfully', type: 'success' });
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

  // Сначала собираем обновления и новые вопросы
  for (const [blockIdStr, formArray] of Object.entries(this.questionsOfBlock)) {
    const blockId = +blockIdStr;
    const block = this.blocks.find(b => b.id === blockId)!;

    block.numberOfQuestions = formArray.length; // Пересчёт количества

    for (const form of formArray.controls) {
      const value = form.value;
      const questionData: Question = {
        text: value.text,
        imageUrl: value.imageUrl || null,
        isActive: value.isActive,
        blockId: blockId,
      };

      if (value.id && !value.isCloned) {
        questionData.id = value.id;
        payloadToUpdate.push(questionData);
      } else {
        payloadToCreate.push(questionData);
      }
    }
  }

  try {
    // Удаление вопросов
    if (this.questionsToDelete?.length > 0) {
      await firstValueFrom(this.testService.deleteQuestions(this.questionsToDelete));
      console.log('Deleted questions:', this.questionsToDelete);
      this.questionsToDelete = [];
    }

    // Обновление блоков
    for (const block of this.blocks) {
      await firstValueFrom(this.testService.updateBlock(this.testId, block.id!, block));
      console.log('Block updated:', block);
    }

    // Обновление существующих вопросов
    if (payloadToUpdate.length > 0) {
      await firstValueFrom(this.testService.updateQuestions(this.testId, payloadToUpdate));
      console.log('Questions updated successfully:', payloadToUpdate);
    }

    // Сохранение новых вопросов
    if (payloadToCreate.length > 0) {
      await firstValueFrom(this.testService.saveQuestionsBatch(this.testId, payloadToCreate));
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
    }
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
      console.log('Deleting image for block:', blockId, 'question index:', questionIndex);

      const questionForm = this.getQuestionsFormsForBlock(blockId).at(questionIndex);
      const imageUrl = questionForm.get('imageUrl')?.value;
      const questionId = questionForm.get('id')?.value;

      if (!imageUrl) return; // только если вообще нет картинки — выходим

      const isTemp = imageUrl.includes('tmp/');

      // удаляем с сервера только если не временная и id есть
      if (!isTemp && questionId) {
        this.testService.deleteImage(imageUrl, questionId).subscribe(
          (res) => console.log('Deleted from server & DB:', res),
          (err) => console.error('Error deleting:', err)
        );
      }

      // очищаем значения
      questionForm.patchValue({
        imageUrl: '',
        hasImage: false,
        isUploadingImage: false,
      });

      // обновляем превью
      if (this.imagePreviews[blockId]?.[questionIndex]) {
        const updated = { ...this.imagePreviews[blockId] };
        delete updated[questionIndex];
        this.imagePreviews[blockId] = { ...updated };
      }

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
    console.log('Setting validators for imageUrl');
    imageUrlControl?.setValidators([Validators.required]);
    imageUrlControl?.markAsTouched();
  } else {
    imageUrlControl?.clearValidators();
    imageUrlControl?.setValue('');
  }
  imageUrlControl?.updateValueAndValidity();
  
}

async saveTest(navigate: boolean = false): Promise<void> {
  if (!this.testState) return;

  // 🛑 Проверка на невалидные вопросы
  if (this.hasInvalidQuestions()) {
    this.toast.show({
      message: 'Please fill in all required fields for questions',
      type: 'warning',
    });
    this.markAllQuestionsAsTouched(); // Чтобы подсветились ошибки
    return;
  }

  // ✅ Сохраняем вопросы
  if (!this.questions || this.questions.length === 0) {
    this.markAllQuestionsAsTouched();
    await this.saveAllQuestions();
    console.log('New questions saved successfully');
    this.toast.show({message: 'Questions saved successfully', type: 'success'});
  } else {
    this.updateQuestions();
    this.toast.show({message: 'Questions updated successfully', type: 'success'});
  }

  // 2. Обновляем шаг, если нужно
  let targetState = this.testState;
  if (this.testState.currentStep < 4) {
    this.testState.currentStep = 4;
    targetState = await firstValueFrom(
      this.testService.updateTestStateStep(this.testId!, this.testState)
    );
    console.log('Test state updated to step 4:', targetState);
  }

  // 3. Триггерим обновление ресурсов
  this.resourceService.triggerRefresh();

  // 4. Навигация (если передано navigate = true)
  if (navigate) {
    this.handleNavigation(targetState);
  }
}


  private handleNavigation(testState: any) {
    const step = testState.currentStep;
    if (step === 4) {
      this.toast.show({
        message: 'Going to next step...',
        type: 'info',
      });
      setTimeout(() => {
        this.router.navigate(['/test-answers/new']);
      }, 700);
    } else if (step > 4) {
      if (!this.testId) {
        console.error('Cannot navigate to edit: testId is missing');
        return;
      }
      this.router.navigate(['/test-scales/answers/', this.testId]);
    }
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

getError(field: string, blockId: number, questionIndex: number): string | null {
  const formArray = this.getQuestionsFormsForBlock(blockId);
  if (!formArray || questionIndex >= formArray.length) return null;

  const control = formArray.at(questionIndex)?.get(field);
  return control && control.touched ? this.validationService.getErrorMessage(control, field) : null;
}


  markAllQuestionsAsTouched() {
    for (const formArray of Object.values(this.questionsOfBlock)) {
      for (const form of formArray.controls) {
        form.markAllAsTouched();
      }
    }
  }

    handleQuestionSelection(question: Question) {
  // 1. Перебираем все блоки по порядку
  for (let i = 0; i < this.blocks.length; i++) {
    const block = this.blocks[i];
    const formArray = this.questionsOfBlock[block.id!];

    if (!formArray || formArray.length === 0) continue;

    // 2. Ищем первую пустую форму
    const emptyForm = formArray.controls.find(ctrl =>
      !ctrl.get('text')?.value?.trim()
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

  // 3. Если ни в одном блоке не нашлось места
  console.warn('Все блоки заполнены. Вставка невозможна.');
}

onDragOver(event: DragEvent) {
  event.preventDefault(); // нужно для drop
}

onDrop(event: DragEvent, blockId: number, formIndex: number) {
  event.preventDefault();
  const raw = event.dataTransfer?.getData('application/json');
  if (!raw) return;

  const droppedQuestion: Question = JSON.parse(raw);
  console.log('Dropping question with realId:', droppedQuestion.id);


  const formArray = this.questionsOfBlock[blockId];
  const form = formArray?.at(formIndex);

  if (!form) {
    console.warn(`Форма с индексом ${formIndex} не найдена в блоке ${blockId}`);
    return;
  }

  const existingText = form.get('text')?.value?.trim();
  const existingImage = form.get('imageUrl')?.value;
  const existingHasImage = form.get('hasImage')?.value;
  const existingId = form.get('id')?.value;
  const existingRealId = form.get('realId')?.value;


  // 🌀 Вернуть старый вопрос, если он был
  if (existingText || existingImage) {
const existingQuestion: Question = {
  id: existingId,
  realId: existingRealId,
  text: existingText,
  imageUrl: existingImage || '',
  isActive: true,
  hasImage: !!existingImage || existingHasImage,
  blockId: 0,
};
    this.selectorComponent?.restoreQuestion(existingQuestion);
  }

  // 🆕 Генерим временный id
  const tempId = `temp-${Date.now()}-${Math.random()}`;

  form.patchValue({
    id: tempId,
    realId: droppedQuestion.id, // сохраняем оригинальный id
    text: droppedQuestion.text,
    imageUrl: droppedQuestion.imageUrl || '',
    isActive: true,
    hasImage: !!droppedQuestion.imageUrl,
    isCloned: true
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
  if (!realId) return; // Это уже новый вопрос, не из базы

  const editedQuestion: Question = {
    id: undefined, // уже отредактированный — новый
    text: form.get('text')?.value,
    imageUrl: form.get('imageUrl')?.value || '',
    isActive: form.get('isActive')?.value,
    blockId: 0,
    realId: realId // оригинальный айди, чтобы вернуть в список
  };

  this.selectorComponent?.restoreQuestion(editedQuestion);

  // И чистим realId, чтобы больше не возвращался
  form.patchValue({ realId: null });
}

  get completedStepsArray(): number[] {
    if (!this.testState || !this.testState.currentStep) {
      return [];
    }
    console.log(Array.from({ length: this.testState.currentStep }, (_, i) => i + 1));
    return Array.from({ length: this.testState.currentStep }, (_, i) => i + 1);
  }

    onStepSelected(step: number) {
      if (!this.testId || !stepRoutes[step]) return;
      this.router.navigate(stepRoutes[step](this.testId));
    }

  confirmDialogVisible = false;
  confirmDialogMessage = 'Are you sure you want to delete this question?';


  pendingDeleteBlockId: number | null = null;
  pendingDeleteQuestionIndex: number | null = null;

  askDeleteConfirmation(blockId: number, index: number) {
  this.pendingDeleteBlockId = blockId;
  this.pendingDeleteQuestionIndex = index;
  this.confirmDialogVisible = true;
}

  onConfirmDelete() {
    if (this.pendingDeleteBlockId !== null && this.pendingDeleteQuestionIndex !== null) {
      this.removeQuestionFromBlock(this.pendingDeleteBlockId, this.pendingDeleteQuestionIndex);
      this.toast.show({message: 'Question deleted successfully', type: 'success'});
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


}

