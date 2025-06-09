import { Injectable } from '@angular/core';
import { AbstractControl, FormArray, FormGroup, ValidationErrors } from '@angular/forms';
import { Answer, Scale } from '../interfaces/test.interface';


@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  constructor() { }

  getErrorMessage(control: AbstractControl, fieldName: string): string | null {
    if (control.hasError('required')) return `${fieldName} field is required`;
    if (control.hasError('minlength')) return `${fieldName} must be at least ${control.errors?.['minlength'].requiredLength} characters long`;
    if (control.hasError('min')) return `${fieldName} must be at least ${control.errors?.['min'].min}`;
      if (control.hasError('email')) {
    return `Please enter a valid email (example: user@example.com)`;
  }
    if (control.hasError('pattern')) {
    if (fieldName === 'phone') {
      return `Phone number must be in international format (e.g. +1234567890)`;
    }
      return `Invalid ${this.formatFieldName(fieldName)} format`;
    }
    if (control.hasError('formIncomplete')) {
      return `Please fill out all the fields.`;
    }
    return null;
  }

    private formatFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }


  everythingFilledValidator(control: AbstractControl): ValidationErrors | null {
    if (!control || !(control instanceof FormArray)) return null;

    const hasEmpty = control.controls.some((group: AbstractControl) => {
      const text = (group as FormGroup).get('text')?.value;
      return !text || !text.trim();
    });

    return hasEmpty ? { formIncomplete: true } : null;
  }

  allAnswersFilledValidator(control: AbstractControl): ValidationErrors | null {
    if (!control || !(control instanceof FormArray)) return null;

    const hasEmpty = control.controls.some((group: AbstractControl) => {
      const textValue = (group as FormGroup).get('text')?.value;
      return !textValue || !textValue.trim();
    });

    return hasEmpty ? { answersIncomplete: true } : null;
  }

  validateWeightsForQuestion(
  questionId: number,
  questionType: string,
  getAnswers: () => Answer[],
  getScales: () => Scale[],
  getValue: (scaleId: number, answerId: number) => number | null
): ValidationErrors | null {
  const answers = getAnswers();
  const scales = getScales();

  const errors: ValidationErrors = {};

  const activeScales = new Set<string>();
  const gradualScales: string[] = [];

  for (const scale of scales) {
    const values = answers.map((a) => getValue(scale.id!, a.id!));

    if (scale.scaleType === 'unipolar') {
      const count = values.filter((v) => v === 1).length;
      if (questionType === 'single-choice' && count > 1) {
        errors['tooManyKeysForSingleChoice'] = true;
      }
      if (count > 0) activeScales.add(scale.id!.toString());
    }

    if (scale.scaleType === 'bipolar') {
      const has1 = values.some((v) => v === 1);
      const hasMinus1 = values.some((v) => v === -1);
      if (has1 && hasMinus1) {
        errors['bipolarConflictOnAnswer'] = true;
      }
      if (has1 || hasMinus1) activeScales.add(scale.id!.toString());
    }

    if (scale.scaleType === 'gradual') {
      const set = new Set<number>();
      let hasValue = false;
      for (const v of values) {
        if (v == null || v == undefined) {
          errors['gradualIncomplete'] = true;
          break;
        }
        if (set.has(v)) {
          errors['gradualDuplicateValues'] = true;
          break;
        }
        set.add(v);
        hasValue = true;
      }
      if (hasValue) gradualScales.push(scale.id!.toString());
    }
  }

  if (questionType === 'single-choice' && activeScales.size > 1) {
    errors['singleChoiceMultipleScales'] = true;
  }

  if (gradualScales.length > 1) {
    errors['multipleGradualScalesConflict'] = true;
  }

  return Object.keys(errors).length ? errors : null;
}



}
