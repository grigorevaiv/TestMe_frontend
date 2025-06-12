import { Component, effect, EventEmitter, inject, Output } from '@angular/core';
import { ResourceService } from '../../services/resource.service';
import { Block, Question, QuestionWithTags, Tag } from '../../interfaces/test.interface';
import { LowerCasePipe } from '@angular/common';

@Component({
  selector: 'app-question-selector',
  imports: [LowerCasePipe],
  templateUrl: './question-selector.component.html',
  styleUrl: './question-selector.component.css'
})
export class QuestionSelectorComponent {
  private resourceService = inject(ResourceService);

  questions: QuestionWithTags[] = [];
  tags: Tag[] = [];

  selectedTagId: number = 0;
  searchText: string = '';
  filteredQuestions: QuestionWithTags[] = [];

  @Output() selectQuestion = new EventEmitter<Question>();
  constructor() {
    effect(() => {
      this.questions = this.resourceService.allQuestionsResource.value() ?? [];
      this.tags = this.resourceService.allTagsResource.value() ?? [];
      console.log('Questions:', this.questions);
      this.applyFilters();
    });
  }

  onFilterChange(blockSelect: Event) {
    const select = blockSelect.target as HTMLSelectElement;
    this.selectedTagId = Number(select.value);
    console.log('Selected tag ID:', this.selectedTagId);
    this.applyFilters();
  }

  onSearchChange(inputEvent: Event) {
    const input = inputEvent.target as HTMLInputElement;
    this.searchText = input.value.toLowerCase();
    this.applyFilters();
  }

  applyFilters() {
    this.filteredQuestions = this.questions.filter(q => {
      const matchesTag =
        this.selectedTagId === 0 || q.tagsIds?.includes(this.selectedTagId);
      const matchesText =
        !this.searchText || q.text.toLowerCase().includes(this.searchText.toLowerCase());
      return matchesTag && matchesText;
    });
  }

onQuestionSelect(question: QuestionWithTags) {
  const { id, text, imageUrl, isActive, blockId } = question;
  this.selectQuestion.emit({ id, text, imageUrl, isActive, blockId }); // чистый Question

  this.questions = this.questions.filter(q => q.id !== id);
  this.filteredQuestions = this.filteredQuestions.filter(q => q.id !== id);
}

onDragStart(event: DragEvent, question: QuestionWithTags) {
  const { id, text, imageUrl, isActive, blockId } = question;
  const pureQuestion: Question = { id, text, imageUrl, isActive, blockId };

  event.dataTransfer?.setData('application/json', JSON.stringify(pureQuestion));
}


  removeQuestion(id: number) {
    this.questions = this.questions.filter(q => q.id !== id);
    this.applyFilters();
  }

restoreQuestion(question: Question) {
  const realId = typeof question.realId === 'string' ? parseInt(question.realId, 10) : question.realId;

  console.log('Trying to restore question with realId:', realId);

  const all = this.resourceService.allQuestionsResource.value() as QuestionWithTags[];
  const fullQuestion = all.find(q => q.id === realId);
  console.log('Full question found:', fullQuestion);

  if (fullQuestion) {
    this.questions = [...this.questions, fullQuestion];
    this.questions = all.filter(q =>
      this.questions.some(qq => qq.id === q.id) || q.id === fullQuestion.id
    );
    this.applyFilters();
  } else {
    console.warn('Question not found in resource for restoration', { realId, availableIds: all.map(q => q.id) });
  }
}



}

