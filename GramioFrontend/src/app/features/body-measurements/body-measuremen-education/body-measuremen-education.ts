import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MeasurementEducationItem {
  key: string;
  title: string;
  location: string;
  instructions: string[];
  tip: string;
}

@Component({
  selector: 'app-body-measurement-education',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './body-measuremen-education.html',
  styleUrl: './body-measuremen-education.css'
})
export class BodyMeasurementEducation {
  @Input() open = false;

  /**
   * Si se informa una métrica, el modal muestra esa medida.
   * Si es null, muestra la guía completa.
   */
  @Input() metric: string | null = null;

  @Output() closed = new EventEmitter<void>();

  readonly guides: MeasurementEducationItem[] = [
    {
      key: 'neck_cm',
      title: 'Cuello',
      location: 'Rodeá el cuello por debajo de la nuez.',
      instructions: [
        'Mantené la cabeza recta y los hombros relajados.',
        'Pasá la cinta alrededor del cuello, sin apretar.',
        'Comprobá que la cinta esté nivelada antes de leer el resultado.'
      ],
      tip: 'No levantes el mentón ni comprimas la piel con la cinta.'
    },
    {
      key: 'shoulders_cm',
      title: 'Hombros',
      location: 'Alrededor de la parte más ancha de los hombros.',
      instructions: [
        'Parate derecho, con los brazos relajados.',
        'Rodeá los hombros y la parte superior del torso con la cinta.',
        'Comprobá que la cinta siga un recorrido consistente y quede nivelada.'
      ],
      tip: 'Es una medición difícil de realizar sin ayuda. Si podés, pedile a alguien que te ayude.'
    },
    {
      key: 'chest_cm',
      title: 'Pecho',
      location: 'Alrededor del tórax, pasando por la parte más prominente del pecho.',
      instructions: [
        'Parate derecho y mantené los brazos relajados.',
        'Pasá la cinta alrededor del tórax, por debajo de las axilas.',
        'Comprobá que quede horizontal por delante y por detrás.',
        'Leé el resultado respirando normalmente, sin inflar el pecho.'
      ],
      tip: 'No tires de la cinta hasta hundirla en la piel.'
    },
    {
      key: 'arm_relaxed_cm',
      title: 'Brazo relajado',
      location: 'Alrededor de la parte más ancha del brazo, sin contraer el músculo.',
      instructions: [
        'Dejá el brazo colgando naturalmente al costado del cuerpo.',
        'Rodeá la parte más ancha del brazo con la cinta.',
        'Mantené el brazo relajado mientras tomás la medida.'
      ],
      tip: 'No flexiones el bíceps. Usá el mismo brazo en futuras mediciones.'
    },
    {
      key: 'arm_flexed_cm',
      title: 'Brazo flexionado',
      location: 'Alrededor de la parte más ancha del brazo con el bíceps contraído.',
      instructions: [
        'Flexioná el codo y contraé el bíceps.',
        'Colocá la cinta alrededor de la zona más ancha del brazo.',
        'Mantené la contracción mientras leés el resultado.'
      ],
      tip: 'Intentá repetir la postura y el nivel de contracción cada vez que te midas.'
    },
    {
      key: 'waist_cm',
      title: 'Cintura',
      location: 'En la zona media del torso, entre las costillas inferiores y la parte superior de la cadera.',
      instructions: [
        'Parate derecho con el abdomen relajado.',
        'Rodeá la cintura con la cinta, manteniéndola horizontal.',
        'Respirá normalmente y no metas la panza.',
        'Tomá la lectura al final de una exhalación normal.'
      ],
      tip: 'La cintura no siempre coincide con el ombligo. Elegí un punto anatómico consistente y repetilo en cada registro.'
    },
    {
      key: 'hip_cm',
      title: 'Cadera',
      location: 'Alrededor de la parte más ancha de los glúteos.',
      instructions: [
        'Parate derecho y mantené los pies en una posición cómoda y constante.',
        'Pasá la cinta alrededor de la parte más prominente de los glúteos.',
        'Usá un espejo para comprobar que la cinta no quede inclinada.',
        'Ajustá la cinta sin comprimir los tejidos.'
      ],
      tip: 'No midas la cintura ni solamente sobre los huesos de la pelvis: buscá el contorno más ancho de los glúteos.'
    },
    {
      key: 'thigh_cm',
      title: 'Muslo',
      location: 'Alrededor del muslo, siempre en el mismo punto.',
      instructions: [
        'Parate con la pierna relajada y el peso repartido.',
        'Elegí un punto de referencia, por ejemplo, una distancia fija desde la parte superior de la rótula.',
        'Rodeá el muslo con la cinta, manteniéndola horizontal.',
        'Registrá el valor sin contraer el músculo.'
      ],
      tip: 'No cambies la altura de la cinta entre mediciones: unos centímetros pueden modificar el resultado.'
    },
    {
      key: 'calf_cm',
      title: 'Pantorrilla',
      location: 'Alrededor de la parte más ancha de la pantorrilla.',
      instructions: [
        'Parate derecho, con la pierna relajada.',
        'Deslizá la cinta hasta encontrar el contorno más ancho de la pantorrilla.',
        'Comprobá que la cinta esté nivelada.',
        'Anotá el resultado sin apretar la cinta.'
      ],
      tip: 'Usá siempre la misma pierna y evitá contraer voluntariamente el músculo.'
    }
  ];

  get visibleGuides(): MeasurementEducationItem[] {
    if (!this.metric) {
      return this.guides;
    }

    const selected = this.guides.find(
      guide => guide.key === this.metric
    );

    return selected ? [selected] : this.guides;
  }

  get isSingleGuide(): boolean {
    return !!this.metric &&
      this.guides.some(guide => guide.key === this.metric);
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.close();
    }
  }
}