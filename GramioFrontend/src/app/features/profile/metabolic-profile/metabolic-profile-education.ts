export type EducationTopic =
  | 'tmb'
  | 'tdee'
  | 'calories'
  | 'activity'
  | 'formula'
  | 'goal'
  | 'protein'
  | 'fat'
  | 'carbs'
  | 'fiber'
  | 'distribution';

export interface EducationContent {
  title: string;
  intro: string;
  points: string[];
  takeaway: string;
}

export const EDUCATION_CONTENT: Record<EducationTopic, EducationContent> = {
  tmb: {
    title: 'TMB: tu metabolismo basal',
    intro:
      'Es una estimación de la energía que tu organismo necesita en reposo para mantener sus funciones vitales.',
    points: [
      'Incluye procesos como la respiración, la circulación y el funcionamiento del cerebro.',
      'No representa todo lo que gastás durante el día: caminar, entrenar y digerir alimentos también requieren energía.',
      'El resultado depende de variables como el peso, la altura, la edad, el sexo utilizado por la fórmula y, según el método, la masa libre de grasa.',
      'Las ecuaciones ofrecen estimaciones poblacionales; no son una medición directa de tu metabolismo.'
    ],
    takeaway:
      'La TMB es una referencia fisiológica, no una meta de calorías que debas consumir ni un límite clínico universal.'
  },

  tdee: {
    title: 'TDEE: tu gasto diario total',
    intro:
      'Es una estimación de la energía que gastás a lo largo de un día completo.',
    points: [
      'Parte de la TMB e incorpora el movimiento cotidiano, el ejercicio y la energía utilizada para digerir y procesar los alimentos.',
      'El factor de actividad simplifica esos componentes; no mide exactamente tu gasto real.',
      'Dos personas con datos parecidos pueden gastar cantidades diferentes por su actividad, composición corporal y otros factores.',
      'La evolución del peso y del rendimiento, observada durante varias semanas, ayuda a evaluar si la estimación es adecuada.'
    ],
    takeaway:
      'El TDEE es un punto de partida que se contrasta con la evolución real, no una cifra exacta e invariable.'
  },

  calories: {
    title: '¿Qué representan las calorías?',
    intro:
      'Las calorías expresan energía. La energía total importa, pero no describe por sí sola la calidad nutricional de una alimentación.',
    points: [
      'Si la ingesta queda por debajo del gasto durante un período, el peso suele tender a bajar; si lo supera, suele tender a subir.',
      'El mantenimiento busca que la ingesta y el gasto se aproximen en el tiempo.',
      'La respuesta individual no es perfectamente lineal: cambian el agua corporal, el gasto energético, el apetito y la actividad espontánea.',
      'La proteína, las grasas y los carbohidratos contribuyen a la energía total, pero cumplen funciones fisiológicas diferentes.'
    ],
    takeaway:
      'Usá las calorías como una referencia útil junto con la saciedad, la calidad de los alimentos, la recuperación y el rendimiento.'
  },


  activity: {
    title: 'Cómo elegir tu nivel de actividad',
    intro:
      'El factor de actividad estima cuánto aumenta tu gasto energético total respecto del metabolismo basal. Elegí la categoría que mejor represente tu rutina habitual, no solamente tus entrenamientos.',
    points: [
      'Sedentaria (1,20): pasás gran parte del día sentado, caminás poco y realizás poco movimiento fuera de las tareas básicas.',
      'Ligera (1,375): caminás algo durante el día y realizás actividad física ligera u ocasional.',
      'Ligera-moderada (1,45): entrenás varias veces por semana y tenés algo de movimiento cotidiano, pero no mantenés una actividad alta durante todo el día.',
      'Moderada (1,55): combinás entrenamiento regular con un nivel general de movimiento moderado.',
      'Alta (1,725): entrenás intensamente y con frecuencia, o tu trabajo requiere bastante esfuerzo físico.',
      'Muy alta (1,90): combinás un volumen de entrenamiento muy elevado con una rutina físicamente exigente.',
      'No existe una equivalencia exacta entre días de gimnasio y factor de actividad. Dos personas que entrenan lo mismo pueden tener gastos diarios diferentes.',
      'Los factores son estimaciones. La evolución del peso, la ingesta registrada y el rendimiento durante varias semanas ayudan a evaluar si el valor elegido es adecuado.'
    ],
    takeaway:
      'Si dudás entre dos categorías, empezá por la que mejor describa tu actividad cotidiana completa. Después contrastá el gasto estimado con tu evolución real y ajustá gradualmente.'
  },


  formula: {
    title: '¿Por qué hay distintas fórmulas?',
    intro:
      'Mifflin-St Jeor, Harris-Benedict y Katch-McArdle estiman el gasto en reposo utilizando distintos datos y supuestos.',
    points: [
      'Mifflin-St Jeor utiliza peso, altura, edad y el sexo contemplado por la ecuación.',
      'Harris-Benedict también utiliza esas variables, con coeficientes distintos.',
      'Katch-McArdle estima el metabolismo a partir de la masa libre de grasa, por lo que depende de contar con un porcentaje graso razonablemente fiable.',
      'Cambiar de fórmula puede cambiar el resultado sin que haya cambiado tu metabolismo real.'
    ],
    takeaway:
      'Una fórmula no es una medición. La consistencia y la comparación con tu evolución ayudan a elegir una referencia práctica.'
  },

  goal: {
    title: 'Déficit, mantenimiento y superávit',
    intro:
      'El ajuste energético modifica el TDEE estimado para proponer un objetivo diario inicial.',
    points: [
      'Déficit: el objetivo queda por debajo del gasto estimado y suele favorecer la pérdida de peso a lo largo del tiempo.',
      'Mantenimiento: el objetivo se aproxima al gasto estimado y busca estabilizar el peso.',
      'Superávit: el objetivo queda por encima del gasto estimado y puede favorecer la ganancia de peso y apoyar el desarrollo muscular junto con entrenamiento adecuado.',
      'Un ajuste mayor no garantiza mejores resultados. Un déficit excesivo puede dificultar la recuperación y el rendimiento.',
      'La respuesta depende de la adherencia, la actividad, la composición corporal y la adaptación del organismo.'
    ],
    takeaway:
      'El objetivo debe ser sostenible y revisarse según la evolución. Si hay condiciones médicas o necesidades especiales, conviene personalizarlo con un profesional.'
  },

  protein: {
    title: 'Proteínas: construir y reparar',
    intro:
      'Las proteínas aportan aminoácidos necesarios para los músculos y para muchas otras funciones del organismo.',
    points: [
      'Participan en la reparación y el mantenimiento de tejidos y en la formación de enzimas, transportadores y otras moléculas.',
      'Una ingesta suficiente puede ayudar a conservar la masa muscular durante un déficit energético.',
      'Las necesidades dependen del peso, el entrenamiento, la edad, el objetivo y el estado de salud.',
      'Fuentes habituales incluyen huevos, lácteos, pescado, carnes, soja y legumbres.',
      'Como referencia energética general, un gramo de proteína aporta aproximadamente 4 kcal.'
    ],
    takeaway:
      'Más proteína no siempre significa más músculo: también importan el entrenamiento, la energía total, el descanso y tus necesidades reales.'
  },

  fat: {
    title: 'Grasas: esenciales para el organismo',
    intro:
      'Las grasas son un nutriente necesario; su mayor densidad energética no las convierte en algo que debas evitar.',
    points: [
      'Forman parte de las membranas celulares y contribuyen a la absorción de las vitaminas A, D, E y K.',
      'Aportan ácidos grasos esenciales y participan en distintos procesos fisiológicos.',
      'Priorizá fuentes como frutos secos, semillas, aceite de oliva, palta y pescado, dentro de una alimentación variada.',
      'La cantidad importa porque aportan aproximadamente 9 kcal por gramo.',
      'Reducirlas demasiado puede dificultar cubrir necesidades nutricionales.'
    ],
    takeaway:
      'El objetivo no es eliminar las grasas, sino consumir una cantidad adecuada y cuidar tanto la calidad como el contexto de la dieta.'
  },

  carbs: {
    title: 'Carbohidratos: energía y rendimiento',
    intro:
      'Los carbohidratos son una fuente de energía importante. No es necesario eliminarlos para perder grasa corporal.',
    points: [
      'El organismo puede almacenar parte de ellos como glucógeno en el hígado y los músculos.',
      'El glucógeno es útil para esfuerzos intensos, como el entrenamiento de fuerza y los deportes intermitentes.',
      'Frutas, legumbres, avena, cereales integrales, papas y otros tubérculos aportan carbohidratos y diferentes nutrientes.',
      'Los alimentos que contienen carbohidratos no son todos equivalentes en fibra, micronutrientes, saciedad o grado de procesamiento.',
      'Como referencia energética general, un gramo de carbohidrato disponible aporta aproximadamente 4 kcal.'
    ],
    takeaway:
      'La cantidad adecuada depende de tus necesidades, preferencias y actividad. Un alimento no determina por sí solo la calidad de toda tu alimentación.'
  },

  fiber: {
    title: 'Fibra: salud intestinal y saciedad',
    intro:
      'La fibra es un conjunto de componentes vegetales que no se digieren como los carbohidratos disponibles.',
    points: [
      'Puede favorecer el tránsito intestinal y alimentar a microorganismos beneficiosos de la microbiota.',
      'Según el tipo de fibra y el alimento, puede ayudar a la saciedad y a regular la respuesta glucémica.',
      'Se encuentra en legumbres, frutas, verduras, avena, semillas y cereales integrales.',
      'Aumentá su consumo gradualmente y acompañalo con una hidratación adecuada.',
      'La energía aportada por la fibra depende del tipo y del método de cálculo; no equivale necesariamente a 4 kcal por gramo.'
    ],
    takeaway:
      'La fibra complementa una alimentación variada. El objetivo calculado es una referencia y no reemplaza la evaluación de tus necesidades individuales.'
  },

  distribution: {
    title: 'Cómo se relacionan los macronutrientes',
    intro:
      'Las calorías expresan energía; los gramos de cada macronutriente muestran cómo se distribuye parte de esa energía.',
    points: [
      'Proteínas: aproximadamente 4 kcal por gramo.',
      'Carbohidratos disponibles: aproximadamente 4 kcal por gramo.',
      'Grasas: aproximadamente 9 kcal por gramo.',
      'La fibra puede contribuir con energía según su tipo y el criterio utilizado. Las etiquetas y los factores específicos pueden generar diferencias.',
      'Si aumentás un macronutriente manteniendo fijas las calorías, normalmente tendrás que reducir otro para conservar el mismo total.',
      'No existe una distribución perfecta para todas las personas: importa cubrir las necesidades, la calidad de la dieta y la posibilidad de sostenerla.'
    ],
    takeaway:
      'Una buena distribución no se evalúa solo por porcentajes: también cuentan los alimentos, la fibra, los micronutrientes, la saciedad y el rendimiento.'
  }
};