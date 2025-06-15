import { Component, EventEmitter, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-time-filter',
  imports: [ReactiveFormsModule],
  templateUrl: './time-filter.component.html',
  styleUrl: './time-filter.component.css'
})
export class TimeFilterComponent {
  fromDate = new FormControl<string | null>(null);
  toDate = new FormControl<string | null>(null);

  @Output() filterChanged = new EventEmitter<{ fromDate?: string; toDate?: string }>();

  emitFilter() {
    this.filterChanged.emit({
      fromDate: this.fromDate.value ?? undefined,
      toDate: this.toDate.value ?? undefined
    });
  }
}
