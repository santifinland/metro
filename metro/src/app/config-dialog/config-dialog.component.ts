import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { SimulationConfigService } from '../services/simulation-config.service';

@Component({
  selector: 'app-config-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './config-dialog.component.html',
  styleUrls: ['./config-dialog.component.css'],
})
export class ConfigDialogComponent {

  readonly form = this.fb.group({
    wagonCapacity:       [this.cfg.config.wagonCapacity,       [Validators.required, Validators.min(1), Validators.max(500)]],
    wagonsPerTrain:      [this.cfg.config.wagonsPerTrain,      [Validators.required, Validators.min(1), Validators.max(20)]],
    trainsPerQuarterHour:[this.cfg.config.trainsPerQuarterHour,[Validators.required, Validators.min(1), Validators.max(30)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly cfg: SimulationConfigService,
    private readonly dialogRef: MatDialogRef<ConfigDialogComponent>,
  ) {}

  get trainCapacity(): number {
    const cap = this.form.value.wagonCapacity ?? 0;
    const wagons = this.form.value.wagonsPerTrain ?? 0;
    return cap * wagons;
  }

  apply(): void {
    if (this.form.invalid) return;
    this.cfg.save(this.form.value as any);
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
