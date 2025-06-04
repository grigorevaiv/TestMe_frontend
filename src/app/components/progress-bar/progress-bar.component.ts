import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [NgClass],
  templateUrl: './progress-bar.component.html',
  styleUrls: [],
})
export class ProgressBarComponent {
  @Input() step: number = 1;
  @Input() totalSteps: number = 8;
  @Input() currentLabel: string = '';
  @Input() completedSteps: number[] = [];
  @Output() stepClicked = new EventEmitter<number>();
  @Input() maxAllowedStep: number = 1;

  stepLabels = [
    'Test info',
    'Blocks',
    'Scales',
    'Questions',
    'Answers',
    'Weights',
    'Norms',
    'Interpretations',
  ];


  totalStepsArray() {
    return Array.from({ length: this.totalSteps }, (_, i) => i + 1);
  }

  onStepClick(i: number) {
    if (i <= this.maxAllowedStep) {
      this.stepClicked.emit(i);
    }
  }


}
