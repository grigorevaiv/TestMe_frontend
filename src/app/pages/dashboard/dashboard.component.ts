import { Component, effect, inject } from '@angular/core';
import { ListItemComponent } from '../../components/list-item/list-item.component';
import { Router } from '@angular/router';
import { ResourceService } from '../../services/resource.service';
import { Test } from '../../interfaces/test.interface';
import { stepRoutes } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';

@Component({
  selector: 'app-dashboard',
  imports: [ListItemComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  resourceService = inject(ResourceService);
  route = inject(Router);
  sessionStorage = inject(SessionStorageService);
  tests: Test[] = [];
  constructor() {
    effect(() => {
      const data = this.resourceService.testsResource.value();
      if (data) {
        this.tests = data;
        console.log('Tests loaded:', this.tests);
        console.log('Dashbord testId', this.sessionStorage.getTestId());
      }
    })
  }

  onCreateTest(){
    this.route.navigate(['/test/new']);
  }



  onEditTest(test: Test) {
    console.log('🧪 Editing test:', test);
    console.log('🔍 test.id:', test.id);
    console.log('📍 test.state:', test.state);
      const step = test.state?.currentStep ?? 1;
      const route = stepRoutes[step]?.(test.id!) ?? ['/test/edit', test.id];
      this.route.navigate(route);
    }


  onDeleteTest(test: Test) {
  }

}
