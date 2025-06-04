import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sentencecase',
})
export class SentencecasePipe implements PipeTransform {

  transform(value: string): string {
    if (!value) return '';

    const words = value.match(/[A-Z][a-z0-9]*|[a-z0-9]+/g);
    if (!words) return value;

    const sentence = words.join(' ').toLowerCase();
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

}
