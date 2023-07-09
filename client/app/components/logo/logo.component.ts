import { NgIf } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { SymbolComponent } from 'client/app/components/logo/symbol/symbol.component';
import { TextComponent } from 'client/app/components/logo/text/text.component';
import { WidetextComponent } from 'client/app/components/logo/widetext/widetext.component';

@Component({
    selector: 'app-logo',
    templateUrl: './logo.component.html',
    styleUrls: ['./logo.component.scss'],
    imports: [
        SymbolComponent,
        TextComponent,
        WidetextComponent,
        NgIf
    ],
    standalone: true
})
export class LogoComponent implements OnInit {

    @Input() showText = true;

  constructor() { }

  ngOnInit() {
  }

}
