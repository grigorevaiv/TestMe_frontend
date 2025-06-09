import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Norm, Scale, Weight } from '../../interfaces/test.interface';
import { TestService } from '../../services/test.service';
import { ResourceService } from '../../services/resource.service';
//import { CacheService } from '../../services/cache.service';
import { ToastService } from '../../services/toast.service';
import { NgIf } from '@angular/common';
import { ProgressBarComponent } from '../../components/progress-bar/progress-bar.component';
import { stepRoutes } from '../../constants/step-routes';
import { SessionStorageService } from '../../services/session-storage.service';
import { TestContextService } from '../../services/test-context.service';

@Component({
  selector: 'app-test-norms',
  imports: [ReactiveFormsModule, NgIf, ProgressBarComponent],
  templateUrl: './test-norms.component.html',
  styleUrl: './test-norms.component.css'
})
export class TestNormsComponent {
  testService = inject(TestService);
  resourceService = inject(ResourceService);
  fb = inject(FormBuilder);
  router = inject(Router);
  route = inject(ActivatedRoute);
  //cacheService = inject(CacheService);
  sessionStorage = inject(SessionStorageService);


  mode: string = '';
  testState: any = null;
  testId: number | null = null;
  norms : Norm[] = [];
  scales: Scale[] = [];
  weights: Weight[] = [];
  toast = inject(ToastService);
  step =7;
  testContextService = inject(TestContextService);

  async ngOnInit(): Promise<void> {
    this.testContextService.resetContext();

    const idParam = this.route.snapshot.paramMap.get('testId');
    const mode = this.route.snapshot.paramMap.get('mode') || 'new';
    const storedId = this.sessionStorage.getTestId();
    const id = idParam ? Number(idParam) : storedId;

    if (!id) {
      console.warn('[TestNormsComponent] No test ID found');
      return;
    }

    this.testId = id;
    this.mode = mode;
    this.sessionStorage.setTestId(id);

    await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId, this.mode));

    this.testContextService.getTest().subscribe(test => {
      this.testState = test?.state ?? null;
      this.testId = test?.id ?? this.testId;
    });

    this.testContextService.getScales().subscribe(scales => {
      if (scales) {
        console.log('Scales received:', scales);
        this.scales = scales;
        this.initializeNormsForms();
      }
    });

    this.testContextService.getNorms().subscribe(norms => {
      if (norms) {
        console.log('Norms received:', norms);
        this.norms = norms;
        this.patchNormsToForm(norms);
      } else {
        console.log('No norms found for testId:', this.testId);
      }
    });

    this.testContextService.getWeights().subscribe(weights => {
      if (weights) {
        console.log('Weights received:', weights);
        this.weights = weights;
      }
    });
  }


  normsForScale: {[scaleId: number]: FormGroup} = {};

  initializeNormsForms() {
    this.scales.forEach((scale: Scale) => {
      if (scale.id === undefined) return;
      this.normsForScale[scale.id] = this.createNormsForm();
    });
  }
  
  getNormsFormForScale(scaleId: number): FormGroup {
    return this.normsForScale[scaleId];
  }

  get completedStepsArray(): number[] {
    const currentStep = this.testState?.currentStep ?? 0;
    return Array.from({ length: currentStep }, (_, i) => i + 1);
  }

  onStepSelected(step: number) {
    if (!this.testId || !stepRoutes[step]) return;
    this.router.navigate(stepRoutes[step](this.testId));
  }
  
  createNormsForm(): FormGroup {
    return this.fb.group({
      id: [null],
      mean: [0, Validators.required],
      stdDev: [0, Validators.required],
      type: ['', Validators.required]
    });
  }

setTheoreticalNorms(scaleId: number) {
  const scaleWeights = this.weights.filter((weight: any) => Number(weight.scaleId) === Number(scaleId));

  if (!scaleWeights.length) {
    console.warn(`No weights found for scaleId ${scaleId}`);
    return;
  }

  const min = scaleWeights.reduce((acc: number, obj: any) => obj.value <= 0 ? acc + obj.value : acc, 0);
  const max = scaleWeights.reduce((acc: number, obj: any) => obj.value > 0 ? acc + obj.value : acc, 0);

  const mean = ((min + max) / 2).toFixed(1);
  const stdDev = ((max - min) / 6).toFixed(1);

  const scaleNorms = this.getNormsFormForScale(scaleId).controls;
  scaleNorms['mean'].setValue(mean);
  scaleNorms['stdDev'].setValue(stdDev);
}


  isAllFieldsFilled(): boolean {
    return (Object.values(this.normsForScale).every(formGroup => 
      formGroup.get('mean')?.value !== 0 && formGroup.get('stdDev')?.value !== 0 && formGroup.get('type')?.value !== ''
    )); 
  }

  get isFormCompletelyFilled(): boolean {
    return this.isAllFieldsFilled();
  }

  patchNormsToForm(norms: Norm[]) {
    norms.forEach(norm => {
      const scaleId = norm.scaleId;
      if (this.normsForScale[scaleId]) {
        this.normsForScale[scaleId].patchValue({
          id: norm.id,
          mean: norm.mean,
          stdDev: norm.stdDev,
          type: norm.type
        });
      } else {
        console.warn(`No form found for scaleId ${scaleId}`);
      }
    });
  }

  async createNorms(): Promise<Norm[]> {
    const newNorms = Object.entries(this.normsForScale)
      .filter(([scaleId]) => !this.norms?.some(n => n.scaleId === +scaleId))
      .map(([scaleId, normsForm]) => ({
        scaleId: +scaleId,
        mean: normsForm.get('mean')?.value,
        stdDev: normsForm.get('stdDev')?.value,
        type: normsForm.get('type')?.value
      }));

    if (newNorms.length === 0) return [];

    const savedNorms = await firstValueFrom(this.testService.addNormsToScales(newNorms));
    return savedNorms;
  }

  async updateNorms(): Promise<Norm[]> {
      if (!this.isAllValid()) {
        this.toast.show({message: 'Please fill all fields before saving', type: 'error'});
        return [];
      }
    const existingNorms = Object.entries(this.normsForScale)
      .filter(([scaleId]) => this.norms?.some(n => n.scaleId === +scaleId))
      .map(([scaleId, normsForm]) => {
        const existing = this.norms?.find(n => n.scaleId === +scaleId);
        return {
          id: existing!.id,
          scaleId: +scaleId,
          mean: normsForm.get('mean')?.value,
          stdDev: normsForm.get('stdDev')?.value,
          type: normsForm.get('type')?.value
        };
      });

    if (existingNorms.length === 0) return [];

    const updatedNorms = await firstValueFrom(this.testService.updateNorms(existingNorms));
    return updatedNorms;
  }

  async saveNorms(navigate: boolean = false): Promise<Norm[] | null> {
      if (!this.isAllValid()) {
        Object.values(this.normsForScale).forEach(f => f.markAllAsTouched());
        this.toast.show({message: 'Please fill all fields before saving', type: 'error'});
        return [];
      }
      

    try {

      let savedNorms: Norm[] = [];

      if (this.norms && this.norms.length > 0) {
        console.log('I see this norms', this.norms);
        savedNorms = await this.updateNorms();
      } 
      console.log('ID:', this.testId);
      
      if (!this.norms || this.norms.length === 0){
        savedNorms = await this.createNorms();
        if(this.testState.currentStep < 7) {
          this.testState.currentStep = 7;
          this.testService.updateTestStateStep(this.testId!, this.testState);
          await firstValueFrom(this.testContextService.loadContextIfNeeded(this.testId!, 'edit'));
          this.router.navigate(['/test-norms/edit', this.testId]); 
        }
      }
      
      if (navigate) {
        this.handleNavigation();
      }

      return savedNorms;

    } catch (error) {
      console.log('Error while saving norms:', error);
      return null;
    }
  }

  handleNavigation() {
    if (!this.testState) return;

    const step = this.testState.currentStep;
    console.log('Current step:', step);

    if (step === 7) {
      this.router.navigate(['/test-interpretations/new']);
    } else if (step > 7) {
      if (!this.testId) {
        console.error('Cannot navigate to edit: testId is missing');
        return;
      }
      this.router.navigate(['/test-interpretations/edit/', this.testId]);
    }
  }

  isAllValid(): boolean {
    return Object.values(this.normsForScale).every(form => form.valid);
  }

  hasAllZeroValues(scaleId: number): boolean {
  const form = this.getNormsFormForScale(scaleId);
  const mean = form.get('mean')?.value;
  const stdDev = form.get('stdDev')?.value;
  return mean === 0 && stdDev === 0;
}

wasFormTouched(scaleId: number): boolean {
  const form = this.getNormsFormForScale(scaleId);
  return !!form.get('mean')?.touched || !!form.get('stdDev')?.touched || !!form.get('type')?.touched;
}


}
