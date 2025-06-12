import { CommonModule } from "@angular/common";
import { Component, Input, Output, EventEmitter } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-search-filter',
  templateUrl: './search-filter.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class SearchFilterComponent {
  @Input() items: any[] = [];
  @Input() filterKeys: string[] = [];
  @Input() placeholder: string = 'Search...';
  @Output() filtered = new EventEmitter<any[]>();

  searchTerm = '';

onSearchChange() {
  const term = this.searchTerm.trim().toLowerCase();

  if (!term) {
    this.filtered.emit(this.items);
    return;
  }

  const filteredItems = this.items.filter(item =>
    this.filterKeys.some(key => {
      const value = key.split('.').reduce((obj, prop) => obj?.[prop], item);

      if (typeof value === 'string') {
        return value.toLowerCase().includes(term);
      }

      if (typeof value === 'boolean') {
        const stringVal = value ? 'active' : 'inactive';
        return stringVal.includes(term);
      }

      if (Array.isArray(value)) {
        return value.some(
          v => typeof v === 'string' && v.toLowerCase().includes(term)
        );
      }

      return false;
    })
  );

  this.filtered.emit(filteredItems);
}


  clearSearch() {
    this.searchTerm = '';
    this.filtered.emit(this.items);
  }

  @Input() set triggerSearch(value: string) {
  if (value !== undefined && value !== null) {
    this.searchTerm = value;
    this.onSearchChange();
  }
}

}
