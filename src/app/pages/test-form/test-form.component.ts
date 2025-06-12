import { Component, effect, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { State, Test } from '../../interfaces/test.interface';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
//import { CacheService } from '../../services/cache.service';
//import { ResourceService } from '../../services/resource.service';
import { TestService } from '../../services/test.service';
import { ValidationService } from '../../services/validation.service';
import { SentencecasePipe } from '../../pipes/sentencecase.pipe';
import { ToastService } from '../../services/toast.service';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { TagChipsComponent } from '../../components/tag-chips/tag-chips.component';
import { stepRoutes } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';
import { NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-test-form',
  standalone: true,
  imports: [ReactiveFormsModule, SentencecasePipe, ProgressBarComponent, TagChipsComponent, NgIf],
  templateUrl: './test-form.component.html',
  styleUrl: './test-form.component.css'
})

export class TestFormComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private testService = inject(TestService);
  private validationService = inject(ValidationService);
  private toast = inject(ToastService);
  private sessionStorage = inject(SessionStorageService);
  private testContextService = inject(TestContextService);

  private testId: number | null = null;
  private mode: string = '';
  step: number = 1;
  completedSteps: number[] = [];
  testState: State | null = null;
  maxAllowedStep: number = 1;
  isNewTest = false;

  defaultTags = [
    'interests', 'intelligence', 'personality', 
    'motivation', 'values', 'self-esteem',
    'emotional intelligence', 'problem-solving',
    'anxiety', 'depression'
  ];
  suggestedTags: string[] = [];

  get filteredSuggestions(): string[] {
    const selectedTags = this.testForm.get('tags')?.value || [];
    return this.suggestedTags.filter(tag => !selectedTags.includes(tag));
  }


  testForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(15)]],
    author: [''],
    version: [''],
    description: ['', [Validators.required, Validators.minLength(100)]],
    instructions: ['', [Validators.required, Validators.minLength(250)]],
    tags: this.fb.control<string[]>([])
  });

 ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('testId');
    this.mode = this.route.snapshot.paramMap.get('mode') || 'new';
    this.testId = idParam ? Number(idParam) : null;
    this.testService.getSuggestedTags().subscribe((tags) => {
      this.suggestedTags = tags.length < 5
      ? [...new Set([...tags, ...this.defaultTags])]
      : tags;
    });
    if (!this.testId) {
      this.testContextService.resetContext();
      this.testState = null;
      this.completedSteps = [1];
      this.maxAllowedStep = 1;
      this.isNewTest = true;
    } else {
      this.sessionStorage.setTestId(this.testId);

      this.testContextService.ensureContext(this.testId, this.mode).subscribe(() => {
        this.testContextService.getTest().subscribe((test) => {
          if (test) {
            this.testState = test.state ?? null;
            this.maxAllowedStep = test.state?.currentStep || 1;
            this.completedSteps = Array.from({ length: this.maxAllowedStep }, (_, i) => i + 1);
            this.testForm.patchValue({
              title: test.title,
              author: test.author,
              version: test.version,
              description: test.description,
              instructions: test.instructions,
              tags: test.tags || []
            });
          }
        });
      });
    }

    this.step = 1;
    window.addEventListener('beforeunload', this.beforeUnloadListener);
  }

  private hasUnsavedChanges(): boolean {
    return this.testForm.dirty;
  }

  private beforeUnloadListener = (event: BeforeUnloadEvent) => {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadListener);
  }

  getError(field: string): string | null {
    const control = this.testForm.get(field);
    return control && control.touched ? this.validationService.getErrorMessage(control, field) : null;
  }

  get currentTags(): string[] {
    return this.testForm.get('tags')?.value || [];
  }

  async saveTest(navigate: boolean = false): Promise<void> {
    const test: Test = this.testForm.value as Test;

    if (!this.testForm.valid) {
      this.testForm.markAllAsTouched();
      this.toast.show({ message: 'Please fill in all required fields correctly', type: 'warning' });
      return;
    }

    try {
      let savedTest: Test;

      if (this.testId) {
        savedTest = await firstValueFrom(this.testService.updateTest(this.testId, test));
        this.toast.show({ message: 'Test updated successfully', type: 'success' });
      } else {
        savedTest = await firstValueFrom(this.testService.addTest(test));
        if (!savedTest || !savedTest.id) {
          console.error('[saveTest] Test ID is not defined after creation:', savedTest);
          return;
        }
        this.toast.show({ message: 'Test created successfully', type: 'success' });
        this.testId = savedTest.id;
        this.sessionStorage.setTestId(savedTest.id);
        this.router.navigate(['/test/edit', savedTest.id]);
        await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, 'edit', true));
      }

      if (navigate) {
        const step = savedTest.state?.currentStep ?? 1;
        this.step = step;
        this.completedSteps.push(this.step);
        this.toast.show({ message: 'Going to next step...', type: 'info' });
        setTimeout(() => {
          this.router.navigate(step === 1 ? ['/test-blocks/new'] : ['/test-blocks/edit', savedTest.id]);
        }, 700);
      }

    } catch (err) {
      console.error('[saveTest] Error:', err);
      const message = err instanceof HttpErrorResponse ? err.error.detail : 'An error occurred while saving the test';
      this.toast.show({ message: message, type: 'error' });
    }
  }

  onTagsChanged(tags: string[]) {
    this.testForm.patchValue({ tags });
  }

  get completedStepsArray(): number[] {
    return this.testState?.currentStep ? Array.from({ length: this.testState.currentStep }, (_, i) => i + 1) : [];
  }

  onStepSelected(step: number) {
    const id = this.testId || this.sessionStorage.getTestId();
    if (!id || !stepRoutes[step]) return;
    this.router.navigate(stepRoutes[step](id));
  }
}



export default TestFormComponent;
