import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Test, Block, Scale } from '../../interfaces/test.interface';
import { NgIf, SlicePipe } from '@angular/common';

@Component({
  selector: 'app-list-item',
  imports: [NgIf, SlicePipe],
  templateUrl: './list-item.component.html',
  styleUrl: './list-item.component.css'
})
export class ListItemComponent {

  @Input() item!: Test | Block | Scale;
  @Input() type!: 'test' | 'block' | 'scale';
  @Input() isEditing = false;

  get test(): Test | null {
    return this.type === 'test' ? this.item as Test : null;
  }

  get block(): Block | null {
    return this.type === 'block' ? this.item as Block : null;
  }

  get scale(): Scale | null {
    return this.type === 'scale' ? this.item as Scale : null;
  }

  @Output() edit = new EventEmitter<Test | Block | Scale>();
  @Output() delete = new EventEmitter<void>();


}
