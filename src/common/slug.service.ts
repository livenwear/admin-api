import { Injectable } from '@nestjs/common';
var ars = require('arslugify');

@Injectable()
export class SlugService {
  generateSlug(title: string): string {
    const slugifiedStr = ars(title);
    return slugifiedStr;
  }
}