import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-tag-chips',
  templateUrl: './tag-chips.component.html',
  imports: [],
  standalone: true
})
export class TagChipsComponent {
  @Input() tags: string[] = [];
  @Input() suggestions: string[] = []; 
  @Output() tagsChange = new EventEmitter<string[]>();
  @ViewChild('tagInput') tagInput!: ElementRef<HTMLInputElement>;

  private toast = inject(ToastService);

  addTag(event: Event) {
    const value = this.tagInput.nativeElement.value.trim().toLowerCase();
    const isEnter = event instanceof KeyboardEvent && event.key === 'Enter';
    const isClick = event instanceof MouseEvent;

    if ((isEnter || isClick)) {
      if (!value) {
        this.toast.show({message: 'Please enter a tag name', type: 'warning'});
        return;
      }

    if (!this.tags.includes(value)) {
      this.tags = [...this.tags, value];
      this.tagsChange.emit(this.tags);
    }

      this.tagInput.nativeElement.value = '';
      event.preventDefault?.();
    }
  }

addSugTag(tag: string) {
  const value = tag.trim().toLowerCase();
  if (!this.tags.includes(value)) {
    this.tags = [...this.tags, value];
    this.tagsChange.emit(this.tags);
  } else {
    this.toast.show({ message: 'This tag is already added', type: 'info' });
  }
}


  removeTag(tag: string) {
  this.tags = this.tags.filter(t => t !== tag);
  this.tagsChange.emit(this.tags);
  }
}
