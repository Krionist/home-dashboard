import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { W } from '../config';

@Component({
  selector: 'app-iframe',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <iframe [src]="src()" [style.height.px]="w().height ?? 700" style="width:100%;border:0"></iframe>
    </section>`,
})
export class IframeWidget {
  readonly w = input.required<W<'iframe'>>();
  private readonly san = inject(DomSanitizer);
  // url comes from our own config.json, so trusting it is fine
  readonly src = computed(() => this.san.bypassSecurityTrustResourceUrl(this.w().url));
}
