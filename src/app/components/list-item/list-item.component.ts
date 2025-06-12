import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Test, Block, Scale, User } from '../../interfaces/test.interface';
import { JsonPipe, NgIf, SlicePipe } from '@angular/common';

@Component({
  selector: 'app-list-item',
  imports: [NgIf, SlicePipe, JsonPipe],
  templateUrl: './list-item.component.html',
  styleUrl: './list-item.component.css'
})
export class ListItemComponent {

  @Input() item!: Test | Block | Scale | User;
  @Input() type!: 'test' | 'block' | 'scale' | 'patient';
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

  get patient(): User | null {
    return this.type === 'patient' ? this.item as User : null;
  }

  @Output() edit = new EventEmitter<Test | Block | Scale | User>();
  @Output() delete = new EventEmitter<void>();
  @Output() view = new EventEmitter<void>();
  @Output() reactivate = new EventEmitter<void>();
  @Output() tagClick = new EventEmitter<string>();

  onTagClicked(tag: string) {
    this.tagClick.emit(tag);
  }

}
