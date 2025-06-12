import { Component, effect, inject } from '@angular/core';
import { ListItemComponent } from '../../components/list-item/list-item.component';
import { NavigationEnd, Router } from '@angular/router';
import { ResourceService } from '../../services/resource.service';
import { Test } from '../../interfaces/test.interface';
import { stepRoutes } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { filter, firstValueFrom, tap } from 'rxjs';
import { SearchFilterComponent } from '../../components/search-filter/search-filter.component';
import { TestService } from '../../services/test.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-dashboard',
  imports: [ListItemComponent, SearchFilterComponent, ConfirmDialogComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  resourceService = inject(ResourceService);
  route = inject(Router);
  testService = inject(TestService);
  sessionStorage = inject(SessionStorageService);
  testContextService = inject(TestContextService);
  tests: Test[] = [];
  filteredTests: Test[] = [];
  placeholder = 'Search tests...';

  confirmVisible = false;
  confirmMessage = '';
  private pendingAction: (() => void) | null = null;

  constructor() {
    this.sessionStorage.clearAll();

    effect(() => {
      this.resourceService.refreshOnNavigationTo('/');
      const data = this.resourceService.testsResource.value();
      console.log('🔄 effect triggered, got data:', data);
      if (data) {
        this.tests = data;
        this.filteredTests = data;
        console.log('Tests loaded:', this.tests);
        console.log('Dashboard testId', this.sessionStorage.getTestId());
      }
    });
  }

  onCreateTest(){
    this.testContextService.resetContext();
    this.sessionStorage.clear();
    this.route.navigate(['/test/new']);
  }

  onEditTest(test: Test) {
      const step = test.state?.currentStep ?? 1;
      console.log('Editing test:', test.id, 'Step:', step);
      const route = stepRoutes[step]?.(test.id!) ?? ['/test/edit', test.id];
      this.sessionStorage.setTestId(test.id!);
      this.route.navigate(route);
  }

  onDeleteTest(test: Test) {
    this.confirmMessage = 'Are you sure you want to deativate this test?';
    this.confirmVisible = true;
    this.pendingAction = async () => {
      await firstValueFrom(this.testService.deactivateTest(test.id!));
      this.resourceService.triggerRefresh();
    };
  }

  onReactivateTest(test: Test) {
    this.confirmMessage = 'Do you want to reactivate this test?';
    this.confirmVisible = true;
    this.pendingAction = async () => {
      await firstValueFrom(this.testService.reactivateTest(test.id!));
      this.resourceService.triggerRefresh();
    };
  }

  onConfirmDialog() {
    this.confirmVisible = false;
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }

  onCancelDialog() {
    this.confirmVisible = false;
    this.pendingAction = null;
  }

  selectedTag = '';

  onTagSelected(tag: string) {
    this.selectedTag = tag;
  }



}
