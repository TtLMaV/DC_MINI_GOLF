/**
 * The fifteen quests.
 *
 * Data only, like the other table files. Nothing is imported here.
 *
 * ---------------------------------------------------------------------------
 * The ids
 * ---------------------------------------------------------------------------
 * `quest.<the quest's own id>.<field>`, so they line up with QUESTS in
 * quests.ts without anything having to be kept in step by hand. The fields are
 * the ones a quest has: name, objective, offer, accepted, progress, done and
 * afterwards.
 *
 * Where the English `progress` branches on how far along you are, there is a
 * `.progress.none` for the nothing-yet case and a `.progress` for the rest.
 * Two ids rather than one clever one, for the same reason the plurals are two
 * ids in strings-npc.ts.
 *
 * ---------------------------------------------------------------------------
 * Placeholders
 * ---------------------------------------------------------------------------
 * `{done}` and `{target}` are the tally. `{left}` is target minus done, worked
 * out before the line is asked for rather than inside it, because arithmetic
 * inside a string is the sort of thing that only works in the language it was
 * written in. `{n}` and `{level}` are whatever the quest happens to need.
 */

export const QUEST_TEXT: Record<string, Record<string, string>> = {
  en: {
    // ---- The Quartermaster asks for skill ----------------------------------
    "quest.five-aces.name": "Five Aces",
    "quest.five-aces.objective": "Hole the practice green in one",
    "quest.five-aces.offer":
      "You want something to do while you wait? Here. The practice green, six and a half metres, dead straight. Hole it in one. Do it five times and I will see you right.",
    "quest.five-aces.accepted": "Five. Not four. I will be counting even if you are not.",
    "quest.five-aces.progress.none": "Not one yet. Five to find.",
    "quest.five-aces.progress":
      "{done} of {target}. {left} to go, and no, the ones you nearly had do not count.",
    "quest.five-aces.done": "Five. I watched every one of them. Take this.",
    "quest.five-aces.afterwards": "You have had that off me once. Go and find something harder.",
    "quest.three-aces.name": "Three Aces",
    "quest.three-aces.objective": "Hole three in one in a single round",
    "quest.three-aces.offer":
      "Three holes in one. Same round, not three afternoons of one apiece. Do that and there is a club on the wall with a flag on it that is yours.",
    "quest.three-aces.accepted": "Three. In one round. I will know.",
    "quest.three-aces.progress": "Still three in one round. No, the practice green does not count.",
    "quest.three-aces.done": "Three. In one round. The Flag Club is yours.",
    "quest.three-aces.afterwards": "You carry the flag now. Nothing more to say about it.",
    "quest.under-par.name": "Under Par",
    "quest.under-par.objective": "Finish the nine under par",
    "quest.under-par.offer":
      "The whole nine, under par. Not level. Under. Nobody here has managed it this month and I would like that to change.",
    "quest.under-par.accepted": "Under. Level is not under.",
    "quest.under-par.progress":
      "Under par on the nine. Level par is the one that catches people out.",
    "quest.under-par.done": "Under par. On this course. I will be telling people about that.",
    "quest.under-par.afterwards":
      "You went under par once. I have not forgotten and neither have you.",
    "quest.all-eights.name": "All Eights",
    "quest.all-eights.objective": "Take exactly eight shots on every hole",
    "quest.all-eights.offer":
      "Eight shots. Every hole. Not seven on the easy one, not nine when it gets away from you. Eight, nine times. There is a ball behind the bar for anyone who can.",
    "quest.all-eights.accepted": "Eight. Every one. I will be counting those too.",
    "quest.all-eights.progress": "Eight on every hole. One seven ruins it, and so does one nine.",
    "quest.all-eights.done":
      "Nine eights. That is worse than playing well and much harder. The 8 Ball is yours.",
    "quest.all-eights.afterwards": "You did the eights. Once is plenty.",
    "quest.all-nine-lost.name": "Every Last One",
    "quest.all-nine-lost.objective": "Run out of shots on all nine holes",
    "quest.all-nine-lost.offer":
      "Here is one nobody asks for. Lose your ball on all nine. Every hole, shots gone. Do that and I will find you something round and heavy to play with.",
    "quest.all-nine-lost.accepted": "All nine. Try not to enjoy it.",
    "quest.all-nine-lost.progress": "All nine, shots gone on every one. Holing one out spoils it.",
    "quest.all-nine-lost.done":
      "Not one of them finished. Here. It is a cannon ball. It suits you.",
    "quest.all-nine-lost.afterwards": "You lost all nine once. Let us leave it there.",
    "quest.secret-eight.name": "The Tenth",
    "quest.secret-eight.objective": "Hole the secret hole in {n} or fewer",
    "quest.secret-eight.offer":
      "Right. There is a tenth hole. Past the ninth, round the back, and no, it is not on the card. Hole it in {n} and I will hand over the two things in this shop I have never been able to put a price on. You will not get out there until you are level {level}, mind. Consider that the point.",
    "quest.secret-eight.accepted": "{n} or fewer. I will know, and do not ask me how.",
    "quest.secret-eight.progress":
      "Still standing. Go and look past the ninth — you will know it when the ground stops being a golf course.",
    "quest.secret-eight.done":
      "You found it and you beat it. Nobody does both.\n\nHere. The Neon Club and the Neon Ball, and I want it on record that I did not sell them to you.",
    "quest.secret-eight.afterwards":
      "You hole the tenth. There is nothing left in here you have not earned.",
    // ---- Shellman, Sally and Coconutty -------------------------------------
    "quest.shell-hoard.name": "The Hundred",
    "quest.shell-hoard.objective": "Hand Shellman {n} shells",
    "quest.shell-hoard.offer":
      "You have hands. Good. I need one hundred shells and I have counted these ones already, so do not offer me those. One hundred. Not ninety-nine. I have been ninety-nine before and I do not care for it.",
    "quest.shell-hoard.accepted": "One hundred. I will keep the tally. I always keep the tally.",
    "quest.shell-hoard.progress.none":
      "Nought. A clean nought. There is something almost restful about a clean nought.",
    "quest.shell-hoard.progress":
      "{done}. {left} short. I say them out loud at night, so I would know if you were lying.",
    "quest.shell-hoard.done":
      "One hundred. One hundred exactly. Take the club, it has been leaning there since before you came.",
    "quest.shell-hoard.afterwards":
      "You did the hundred. We do not speak of the hundred. Bring me more shells.",
    "quest.scrap-wreck.name": "What Sank Us",
    "quest.scrap-wreck.objective": "Bring Sally 8 scrap",
    "quest.scrap-wreck.offer":
      "You have hands and I have a spare detector. There is metal under this floor and I want all of it. Eight pieces to start. I have a theory about how we ended up here and it needs evidence, not opinions.",
    "quest.scrap-wreck.accepted":
      "Eight. Sweep slowly. The thing clicks faster the closer you are, and people always walk too fast.",
    "quest.scrap-wreck.progress": "{done} of {target}. Keep sweeping, it is under you somewhere.",
    "quest.scrap-wreck.done":
      "Hull plate. Rivets sheared clean, not torn. That is not rocks, that is something that hit us. We did not run aground. Somebody put us here.",
    "quest.scrap-wreck.afterwards": "The plate is on the shelf. I look at it more than is healthy.",
    "quest.scrap-golf.name": "Where The Course Came From",
    "quest.scrap-golf.objective": "Bring Sally 12 scrap",
    "quest.scrap-golf.offer":
      "Next question, and it is the one that keeps me up. Nine holes, trimmed, flagged, maintained. Nobody builds that by accident after a shipwreck. Twelve more pieces.",
    "quest.scrap-golf.accepted":
      "Twelve. And look for anything stamped, stamps have dates on them.",
    "quest.scrap-golf.progress": "{done} of {target}. Stamped pieces especially.",
    "quest.scrap-golf.done":
      "A flag bracket. Same alloy as the hull. They built the course out of the ship, which means they were not waiting to be rescued. They were settling in.",
    "quest.scrap-golf.afterwards":
      "The course is made of the ship. I have not decided how I feel about playing it.",
    "quest.scrap-others.name": "The Ones Before",
    "quest.scrap-others.objective": "Find 16 bones for Sally",
    "quest.scrap-others.offer":
      "There are bones on this island and none of them are recent. Sixteen pieces. I want to know whether we are the first crew this happened to, and I am fairly sure of the answer.",
    "quest.scrap-others.accepted":
      "Sixteen. If you find anything with a name on it, do not read it out. Just bring it.",
    "quest.scrap-others.progress": "{done} of {target}. Bring it, do not read it.",
    "quest.scrap-others.done":
      "Three name tags. Three different ships. Forty years apart. We are not the first and on current form we will not be the last.",
    "quest.scrap-others.afterwards": "Three ships. I keep the tags separate from everything else.",
    "quest.scrap-signal.name": "Something To Shout With",
    "quest.scrap-signal.objective": "Bring Sally 20 scrap",
    "quest.scrap-signal.offer":
      "Enough history. Twenty pieces and I can put a transmitter together out of what is down there. The lighthouse has power and nobody has ever asked it for anything but light.",
    "quest.scrap-signal.accepted":
      "Twenty. Copper if you can tell the difference, and you probably cannot, so bring everything.",
    "quest.scrap-signal.progress": "{done} of {target}. Everything. I will sort it.",
    "quest.scrap-signal.done":
      "It transmits. Nothing has answered, but it transmits, and that is the first honest bit of hope this island has produced.",
    "quest.scrap-signal.afterwards":
      "It is still transmitting. Somebody will hear it. Somebody has to.",
    "quest.scrap-mechanism.name": "The Mechanism",
    "quest.scrap-mechanism.objective": "Bring Sally 25 scrap",
    "quest.scrap-mechanism.offer":
      "Last one, and it is for you rather than for me. Twenty-five pieces and I will build you a club out of it. Gears, a proper weighted head, the lot. Consider it wages.",
    "quest.scrap-mechanism.accepted":
      "Twenty-five. I have wanted to build this since the day I got here.",
    "quest.scrap-mechanism.progress":
      "{done} of {target}. It will click when you line it up. That is intentional.",
    "quest.scrap-mechanism.done":
      "There. Every part of that came out of the ground you have been walking over. It is the best thing I have made and I made it out of a shipwreck. Take it.",
    "quest.scrap-mechanism.afterwards":
      "You are carrying my finest work. Try not to lose it in the water on the fifth.",
    "quest.coconut-hundred.name": "Windfall",
    "quest.coconut-hundred.objective": "Hand Coconutty {n} fallen coconuts",
    "quest.coconut-hundred.offer":
      "A hundred. Off the ground, mind, I will not have anyone up my trees, they are old and I am fond of them. Do that and I will make you a ball out of one. It goes further than it has any right to and it smells incredible.",
    "quest.coconut-hundred.accepted":
      "A hundred. Under the palms, on the ground, in your hands, into mine. That is the whole method.",
    "quest.coconut-hundred.progress.none":
      "None yet. They are under the trees. That is where they go when they stop being in the trees.",
    "quest.coconut-hundred.progress": "{done}. {left} to go. Six trees. They are not shy.",
    "quest.coconut-hundred.done":
      "A hundred exactly, and I have not had to climb once. Here, one ball, husk on. It will not roll straight and I would not want it to.",
    "quest.coconut-hundred.afterwards":
      "You did the hundred. Keep bringing them anyway, I will still pay.",
    "quest.blender-blades.name": "Something To Chop With",
    "quest.blender-blades.objective": "Get Sally to part with 10 scrap",
    "quest.blender-blades.offer":
      "Right. Blades. There is a woman in the cave up the beach sat on more cut-up metal than anyone needs, and she owes me for a hat. Ten pieces through her hands and she will know which ten I mean.",
    "quest.blender-blades.accepted":
      "Ten. Tell her it is for the drink and she will stop asking questions.",
    "quest.blender-blades.progress":
      "{done} of {target}. She is in the cave. She is always in the cave.",
    "quest.blender-blades.done":
      "Blades. Sharp ones. Do not put your hand in it, and I should not have to say that.",
    "quest.blender-blades.afterwards":
      "The blades are in. That was the easy part, which is a thing people say before the hard part.",
    "quest.blender-vessel.name": "Something To Chop In",
    "quest.blender-vessel.objective": "Bring Coconutty {n} more coconuts for the jug",
    "quest.blender-vessel.offer":
      "Now something to chop in. Twelve more, and I will hollow out the biggest and keep the rest for the mix. A glass jug on an island is a jug you sweep up. A coconut, you drop it and it bounces.",
    "quest.blender-vessel.accepted":
      "Twelve. I will be picking through them, so do not bring me the split ones.",
    "quest.blender-vessel.progress":
      "{done} of {target}. One of these is going to be a jug and it does not know yet.",
    "quest.blender-vessel.done":
      "That is the jug. Look at it. That is a better jug than anything I owned before the boat sank.",
    "quest.blender-vessel.afterwards":
      "Blades and a jug. Which leaves the part that actually spins.",
    "quest.blender-motor.name": "The Old Motor",
    "quest.blender-motor.objective": "Dig the old motor out of the cave floor",
    "quest.blender-motor.offer":
      "Last piece, and it is the one nobody has. There is a motor in that cave, off the ship, off something, I do not care, and it is under the floor with everything else. Take the detector. Bring me the heavy thing.",
    "quest.blender-motor.accepted":
      "A motor. You will know it when you dig it. It will not sound like the rest of the rubbish.",
    "quest.blender-motor.progress":
      "Still down there. Sweep the far end of the cave, away from where she has been picking it over.",
    "quest.blender-motor.done":
      "That is it. That is the one. Give me an hour.\n\nThere. Blades, a jug, and something to turn them. Come back when you are thirsty, first one is on the house and every one after that is not.",
    "quest.blender-motor.afterwards":
      "Bar is open. Ask me for a drink and mind how you go afterwards, it gets away from people."
  },
  es: {
    // ---- The Quartermaster asks for skill ----------------------------------
    "quest.five-aces.name": "Cinco Ases",
    "quest.five-aces.objective": "Mete el green de prácticas de un golpe",
    "quest.five-aces.offer":
      "¿Quieres algo que hacer mientras esperas? Toma. El green de prácticas, seis metros y medio, recto del todo. Métela de un golpe. Hazlo cinco veces y te compenso.",
    "quest.five-aces.accepted": "Cinco. No cuatro. Yo llevaré la cuenta aunque tú no.",
    "quest.five-aces.progress.none": "Ni una todavía. Quedan cinco.",
    "quest.five-aces.progress":
      "{done} de {target}. Faltan {left}, y no, las que casi metes no cuentan.",
    "quest.five-aces.done": "Cinco. Las he visto todas. Toma esto.",
    "quest.five-aces.afterwards": "Eso ya me lo has sacado una vez. Ve a buscar algo más difícil.",
    "quest.three-aces.name": "Tres Ases",
    "quest.three-aces.objective": "Mete tres hoyos en uno en la misma vuelta",
    "quest.three-aces.offer":
      "Tres hoyos en uno. La misma vuelta, no tres tardes de uno cada una. Hazlo y el palo de la pared con la bandera es tuyo.",
    "quest.three-aces.accepted": "Tres. En una vuelta. Yo me enteraré.",
    "quest.three-aces.progress":
      "Siguen siendo tres en una vuelta. Y no, el green de prácticas no cuenta.",
    "quest.three-aces.done": "Tres. En una vuelta. El Palo de la Bandera es tuyo.",
    "quest.three-aces.afterwards": "Ahora llevas la bandera. No hay más que hablar.",
    "quest.under-par.name": "Bajo Par",
    "quest.under-par.objective": "Termina los nueve bajo par",
    "quest.under-par.offer":
      "Los nueve enteros, bajo par. No en el par. Bajo. Nadie lo ha conseguido este mes y me gustaría que eso cambiara.",
    "quest.under-par.accepted": "Bajo. En el par no es bajo.",
    "quest.under-par.progress": "Bajo par en los nueve. El par exacto es el que pilla a la gente.",
    "quest.under-par.done": "Bajo par. En este campo. Voy a contarlo por ahí.",
    "quest.under-par.afterwards": "Bajaste del par una vez. Ni yo lo he olvidado ni tú tampoco.",
    "quest.all-eights.name": "Todo Ochos",
    "quest.all-eights.objective": "Da exactamente ocho golpes en cada hoyo",
    "quest.all-eights.offer":
      "Ocho golpes. Cada hoyo. Ni siete en el fácil, ni nueve cuando se te va. Ocho, nueve veces. Hay una bola detrás de la barra para quien lo consiga.",
    "quest.all-eights.accepted": "Ocho. Todos. Esos también los cuento.",
    "quest.all-eights.progress": "Ocho en cada hoyo. Un siete lo estropea, y un nueve también.",
    "quest.all-eights.done":
      "Nueve ochos. Es peor que jugar bien y mucho más difícil. La Bola 8 es tuya.",
    "quest.all-eights.afterwards": "Hiciste los ochos. Con una vez basta.",
    "quest.all-nine-lost.name": "Hasta la Última",
    "quest.all-nine-lost.objective": "Quédate sin golpes en los nueve hoyos",
    "quest.all-nine-lost.offer":
      "Aquí va una que no pide nadie. Pierde la bola en los nueve. Cada hoyo, sin golpes. Hazlo y te busco algo redondo y pesado con lo que jugar.",
    "quest.all-nine-lost.accepted": "Los nueve. Intenta no disfrutarlo.",
    "quest.all-nine-lost.progress": "Los nueve, sin golpes en todos. Meter uno lo estropea.",
    "quest.all-nine-lost.done": "Ni uno terminado. Toma. Es una bala de cañón. Te pega.",
    "quest.all-nine-lost.afterwards": "Perdiste los nueve una vez. Dejémoslo ahí.",
    "quest.secret-eight.name": "El Décimo",
    "quest.secret-eight.objective": "Mete el hoyo secreto en {n} golpes o menos",
    "quest.secret-eight.offer":
      "Bien. Hay un décimo hoyo. Pasado el noveno, por detrás, y no, no está en la tarjeta. Métela en {n} y te doy las dos cosas de esta tienda a las que nunca he sabido poner precio. Eso sí, no llegarás allí hasta el nivel {level}. Considéralo parte del asunto.",
    "quest.secret-eight.accepted": "{n} o menos. Yo me enteraré, y no me preguntes cómo.",
    "quest.secret-eight.progress":
      "Sigue en pie. Ve a mirar más allá del noveno. Lo sabrás cuando el suelo deje de ser un campo de golf.",
    "quest.secret-eight.done":
      "Lo encontraste y lo ganaste. Nadie hace las dos cosas.\n\nToma. El Palo Neón y la Bola Neón, y que conste que no te los he vendido.",
    "quest.secret-eight.afterwards":
      "Metiste el décimo. Aquí ya no queda nada que no te hayas ganado.",
    // ---- Shellman, Sally and Coconutty -------------------------------------
    "quest.shell-hoard.name": "Las Cien",
    "quest.shell-hoard.objective": "Dale a Shellman {n} conchas",
    "quest.shell-hoard.offer":
      "Tienes manos. Bien. Necesito cien conchas y estas ya las he contado, así que no me las ofrezcas. Cien. No noventa y nueve. Ya he estado en noventa y nueve y no me gustó.",
    "quest.shell-hoard.accepted": "Cien. Yo llevo la cuenta. Siempre llevo la cuenta.",
    "quest.shell-hoard.progress.none":
      "Cero. Un cero limpio. Hay algo casi reposado en un cero limpio.",
    "quest.shell-hoard.progress":
      "{done}. Faltan {left}. Las digo en voz alta por la noche, así que sabría si me mientes.",
    "quest.shell-hoard.done":
      "Cien. Cien exactas. Coge el palo, lleva ahí apoyado desde antes de que tú llegaras.",
    "quest.shell-hoard.afterwards":
      "Hiciste las cien. De las cien no se habla. Tráeme más conchas.",
    "quest.scrap-wreck.name": "Lo Que Nos Hundió",
    "quest.scrap-wreck.objective": "Tráele a Sally 8 de chatarra",
    "quest.scrap-wreck.offer":
      "Tú tienes manos y yo un detector de sobra. Hay metal bajo este suelo y lo quiero todo. Ocho piezas para empezar. Tengo una teoría sobre cómo acabamos aquí y necesita pruebas, no opiniones.",
    "quest.scrap-wreck.accepted":
      "Ocho. Barre despacio. La cosa hace clic más rápido cuanto más cerca estás, y la gente siempre anda demasiado rápido.",
    "quest.scrap-wreck.progress":
      "{done} de {target}. Sigue barriendo, está debajo de ti en algún sitio.",
    "quest.scrap-wreck.done":
      "Placa del casco. Los remaches cortados limpios, no arrancados. Eso no son rocas, eso es algo que nos golpeó. No encallamos. Alguien nos puso aquí.",
    "quest.scrap-wreck.afterwards":
      "La placa está en el estante. La miro más de lo que sería sano.",
    "quest.scrap-golf.name": "De Dónde Salió el Campo",
    "quest.scrap-golf.objective": "Tráele a Sally 12 de chatarra",
    "quest.scrap-golf.offer":
      "Siguiente pregunta, y es la que me quita el sueño. Nueve hoyos, recortados, con banderas, mantenidos. Nadie construye eso por accidente después de un naufragio. Doce piezas más.",
    "quest.scrap-golf.accepted": "Doce. Y busca cualquier cosa con marca, las marcas llevan fecha.",
    "quest.scrap-golf.progress": "{done} de {target}. Sobre todo las piezas con marca.",
    "quest.scrap-golf.done":
      "Un soporte de bandera. La misma aleación que el casco. Construyeron el campo con el barco, lo que significa que no esperaban que los rescataran. Se estaban instalando.",
    "quest.scrap-golf.afterwards":
      "El campo está hecho del barco. Todavía no sé qué siento al jugarlo.",
    "quest.scrap-others.name": "Los de Antes",
    "quest.scrap-others.objective": "Encuentra 16 huesos para Sally",
    "quest.scrap-others.offer":
      "Hay huesos en esta isla y ninguno es reciente. Dieciséis piezas. Quiero saber si somos la primera tripulación a la que le pasa esto, y me temo que ya sé la respuesta.",
    "quest.scrap-others.accepted":
      "Dieciséis. Si encuentras algo con un nombre, no lo leas en voz alta. Tráelo y ya está.",
    "quest.scrap-others.progress": "{done} de {target}. Tráelo, no lo leas.",
    "quest.scrap-others.done":
      "Tres chapas con nombre. Tres barcos distintos. Cuarenta años de diferencia. No somos los primeros y, tal como va la cosa, no seremos los últimos.",
    "quest.scrap-others.afterwards": "Tres barcos. Las chapas las guardo aparte de todo lo demás.",
    "quest.scrap-signal.name": "Algo Con Lo Que Gritar",
    "quest.scrap-signal.objective": "Tráele a Sally 20 de chatarra",
    "quest.scrap-signal.offer":
      "Basta de historia. Veinte piezas y puedo montar un transmisor con lo que hay ahí abajo. El faro tiene corriente y nadie le ha pedido nunca otra cosa que luz.",
    "quest.scrap-signal.accepted":
      "Veinte. Cobre, si sabes distinguirlo, y probablemente no, así que tráelo todo.",
    "quest.scrap-signal.progress": "{done} de {target}. Todo. Ya lo separo yo.",
    "quest.scrap-signal.done":
      "Transmite. No ha contestado nada, pero transmite, y es la primera esperanza honesta que ha dado esta isla.",
    "quest.scrap-signal.afterwards":
      "Sigue transmitiendo. Alguien lo oirá. Alguien tiene que oírlo.",
    "quest.scrap-mechanism.name": "El Mecanismo",
    "quest.scrap-mechanism.objective": "Tráele a Sally 25 de chatarra",
    "quest.scrap-mechanism.offer":
      "La última, y es para ti más que para mí. Veinticinco piezas y te construyo un palo con ellas. Engranajes, una cabeza bien equilibrada, todo. Considéralo tu sueldo.",
    "quest.scrap-mechanism.accepted":
      "Veinticinco. Llevo queriendo construir esto desde el día que llegué.",
    "quest.scrap-mechanism.progress":
      "{done} de {target}. Hará clic cuando lo alinees. Es a propósito.",
    "quest.scrap-mechanism.done":
      "Ahí lo tienes. Cada pieza salió del suelo que has estado pisando. Es lo mejor que he hecho y lo hice con un naufragio. Cógelo.",
    "quest.scrap-mechanism.afterwards":
      "Llevas mi mejor obra. Intenta no perderla en el agua del quinto.",
    "quest.coconut-hundred.name": "Lo Que Cae del Árbol",
    "quest.coconut-hundred.objective": "Dale a Coconutty {n} cocos caídos",
    "quest.coconut-hundred.offer":
      "Cien. Del suelo, ojo, no quiero a nadie subido a mis árboles, son viejos y les tengo cariño. Hazlo y te haré una bola con uno. Llega más lejos de lo que debería y huele increíble.",
    "quest.coconut-hundred.accepted":
      "Cien. Bajo las palmeras, del suelo, a tus manos, a las mías. Ese es todo el método.",
    "quest.coconut-hundred.progress.none":
      "Ninguno todavía. Están bajo los árboles. Ahí van cuando dejan de estar en los árboles.",
    "quest.coconut-hundred.progress": "{done}. Faltan {left}. Seis árboles. No son tímidos.",
    "quest.coconut-hundred.done":
      "Cien exactos, y no he tenido que trepar ni una vez. Toma, una bola, con cáscara y todo. No rodará recta y no querría que lo hiciera.",
    "quest.coconut-hundred.afterwards":
      "Hiciste los cien. Sigue trayéndolos igual, te seguiré pagando.",
    "quest.blender-blades.name": "Algo Con Lo Que Picar",
    "quest.blender-blades.objective": "Consigue que Sally suelte 10 de chatarra",
    "quest.blender-blades.offer":
      "Bien. Cuchillas. Hay una mujer en la cueva playa arriba sentada sobre más metal cortado del que nadie necesita, y me debe un sombrero. Diez piezas por sus manos y sabrá de qué diez hablo.",
    "quest.blender-blades.accepted":
      "Diez. Dile que es para la bebida y dejará de hacer preguntas.",
    "quest.blender-blades.progress":
      "{done} de {target}. Está en la cueva. Siempre está en la cueva.",
    "quest.blender-blades.done":
      "Cuchillas. Y afiladas. No metas la mano ahí dentro, y no debería tener que decirlo.",
    "quest.blender-blades.afterwards":
      "Las cuchillas están puestas. Esa era la parte fácil, cosa que se dice justo antes de la difícil.",
    "quest.blender-vessel.name": "Algo Donde Picar",
    "quest.blender-vessel.objective": "Tráele a Coconutty {n} cocos más para la jarra",
    "quest.blender-vessel.offer":
      "Ahora algo donde picar. Doce más, y vaciaré el más grande y me quedaré el resto para la mezcla. Una jarra de cristal en una isla es una jarra que acabas barriendo. Un coco lo dejas caer y rebota.",
    "quest.blender-vessel.accepted":
      "Doce. Los voy a ir mirando uno a uno, así que no me traigas los partidos.",
    "quest.blender-vessel.progress":
      "{done} de {target}. Uno de estos va a ser una jarra y todavía no lo sabe.",
    "quest.blender-vessel.done":
      "Esa es la jarra. Míralas. Es mejor jarra que cualquiera que tuve antes de que se hundiera el barco.",
    "quest.blender-vessel.afterwards": "Cuchillas y jarra. Queda la parte que de verdad gira.",
    "quest.blender-motor.name": "El Motor Viejo",
    "quest.blender-motor.objective": "Desentierra el motor viejo del suelo de la cueva",
    "quest.blender-motor.offer":
      "Última pieza, y es la que no tiene nadie. Hay un motor en esa cueva, del barco, de algo, me da igual, y está bajo el suelo con todo lo demás. Coge el detector. Tráeme la cosa pesada.",
    "quest.blender-motor.accepted":
      "Un motor. Lo sabrás en cuanto lo desentierres. No sonará como el resto de la chatarra.",
    "quest.blender-motor.progress":
      "Sigue ahí abajo. Barre el fondo de la cueva, lejos de donde ella ha estado rebuscando.",
    "quest.blender-motor.done":
      "Ese es. Ese mismo. Dame una hora.\n\nAhí está. Cuchillas, jarra y algo que las haga girar. Vuelve cuando tengas sed: la primera la pago yo y todas las demás no.",
    "quest.blender-motor.afterwards":
      "El bar está abierto. Pídeme una copa y ten cuidado después, se le sube a la gente."
  },
  de: {
    // ---- The Quartermaster asks for skill ----------------------------------
    "quest.five-aces.name": "Fünf Asse",
    "quest.five-aces.objective": "Das Übungsgrün mit einem Schlag",
    "quest.five-aces.offer":
      "Willst du was tun, während du wartest? Hier. Das Übungsgrün, sechseinhalb Meter, schnurgerade. Versenk sie mit einem Schlag. Fünfmal, dann kümmere ich mich um dich.",
    "quest.five-aces.accepted": "Fünf. Nicht vier. Ich zähle mit, auch wenn du es nicht tust.",
    "quest.five-aces.progress.none": "Noch keine. Fünf zu holen.",
    "quest.five-aces.progress":
      "{done} von {target}. Noch {left}, und nein, die Fast-Treffer zählen nicht.",
    "quest.five-aces.done": "Fünf. Ich habe jede einzelne gesehen. Nimm das.",
    "quest.five-aces.afterwards": "Das hast du mir einmal abgenommen. Such dir was Schwereres.",
    "quest.three-aces.name": "Drei Asse",
    "quest.three-aces.objective": "Drei Hole-in-one in einer Runde",
    "quest.three-aces.offer":
      "Drei Hole-in-one. Dieselbe Runde, nicht drei Nachmittage mit je einem. Schaff das, und der Schläger mit der Fahne an der Wand gehört dir.",
    "quest.three-aces.accepted": "Drei. In einer Runde. Ich merke das.",
    "quest.three-aces.progress":
      "Immer noch drei in einer Runde. Und nein, das Übungsgrün zählt nicht.",
    "quest.three-aces.done": "Drei. In einer Runde. Der Fahnenschläger gehört dir.",
    "quest.three-aces.afterwards": "Du trägst jetzt die Fahne. Mehr gibt es dazu nicht zu sagen.",
    "quest.under-par.name": "Unter Par",
    "quest.under-par.objective": "Die neun unter Par beenden",
    "quest.under-par.offer":
      "Die ganzen neun, unter Par. Nicht auf Par. Unter. Diesen Monat hat es hier keiner geschafft, und das hätte ich gern anders.",
    "quest.under-par.accepted": "Unter. Auf Par ist nicht unter.",
    "quest.under-par.progress":
      "Unter Par auf den neun. Genau Par ist das, was die Leute erwischt.",
    "quest.under-par.done": "Unter Par. Auf diesem Platz. Davon werde ich erzählen.",
    "quest.under-par.afterwards":
      "Du warst einmal unter Par. Ich habe es nicht vergessen und du auch nicht.",
    "quest.all-eights.name": "Alles Achten",
    "quest.all-eights.objective": "Genau acht Schläge auf jedem Loch",
    "quest.all-eights.offer":
      "Acht Schläge. Jedes Loch. Nicht sieben auf dem leichten, nicht neun, wenn er dir davonläuft. Acht, neunmal. Hinter der Bar liegt ein Ball für den, der das schafft.",
    "quest.all-eights.accepted": "Acht. Jedes einzelne. Die zähle ich auch mit.",
    "quest.all-eights.progress": "Acht auf jedem Loch. Eine Sieben ruiniert es, eine Neun genauso.",
    "quest.all-eights.done":
      "Neun Achten. Das ist schlechter als gut zu spielen und viel schwerer. Der 8er-Ball gehört dir.",
    "quest.all-eights.afterwards": "Du hast die Achten gemacht. Einmal reicht.",
    "quest.all-nine-lost.name": "Jede Einzelne",
    "quest.all-nine-lost.objective": "Auf allen neun Löchern die Schläge verbrauchen",
    "quest.all-nine-lost.offer":
      "Hier ist einer, nach dem niemand fragt. Verlier deinen Ball auf allen neun. Jedes Loch, Schläge alle. Schaff das, und ich finde dir etwas Rundes und Schweres zum Spielen.",
    "quest.all-nine-lost.accepted": "Alle neun. Versuch, es nicht zu genießen.",
    "quest.all-nine-lost.progress":
      "Alle neun, auf jedem die Schläge alle. Eins zu versenken verdirbt es.",
    "quest.all-nine-lost.done": "Kein einziges beendet. Hier. Eine Kanonenkugel. Sie passt zu dir.",
    "quest.all-nine-lost.afterwards": "Du hast einmal alle neun verloren. Belassen wir es dabei.",
    "quest.secret-eight.name": "Das Zehnte",
    "quest.secret-eight.objective": "Das geheime Loch in {n} Schlägen oder weniger",
    "quest.secret-eight.offer":
      "Also gut. Es gibt ein zehntes Loch. Hinter dem neunten, um die Ecke, und nein, es steht nicht auf der Karte. Versenk sie in {n} und ich rücke die beiden Dinge in diesem Laden heraus, für die ich nie einen Preis gefunden habe. Hinkommen wirst du allerdings erst ab Stufe {level}. Betrachte das als den Sinn der Sache.",
    "quest.secret-eight.accepted":
      "{n} oder weniger. Ich werde es wissen, und frag mich nicht wie.",
    "quest.secret-eight.progress":
      "Steht noch. Schau hinter dem neunten nach. Du merkst es, wenn der Boden aufhört, ein Golfplatz zu sein.",
    "quest.secret-eight.done":
      "Du hast es gefunden und geschlagen. Beides schafft sonst niemand.\n\nHier. Der Neonschläger und der Neonball, und ich möchte festhalten, dass ich sie dir nicht verkauft habe.",
    "quest.secret-eight.afterwards":
      "Du hast das zehnte gespielt. Hier drin gibt es nichts mehr, was du dir nicht verdient hast.",
    // ---- Shellman, Sally and Coconutty -------------------------------------
    "quest.shell-hoard.name": "Die Hundert",
    "quest.shell-hoard.objective": "Shellman {n} Muscheln geben",
    "quest.shell-hoard.offer":
      "Du hast Hände. Gut. Ich brauche hundert Muscheln, und diese hier habe ich schon gezählt, also biete sie mir nicht an. Hundert. Nicht neunundneunzig. Ich war schon einmal bei neunundneunzig und es hat mir nicht gefallen.",
    "quest.shell-hoard.accepted": "Hundert. Ich führe die Liste. Ich führe immer die Liste.",
    "quest.shell-hoard.progress.none":
      "Null. Eine saubere Null. Eine saubere Null hat etwas beinahe Erholsames.",
    "quest.shell-hoard.progress":
      "{done}. Noch {left}. Ich sage sie nachts laut auf, ich würde also merken, wenn du lügst.",
    "quest.shell-hoard.done":
      "Hundert. Genau hundert. Nimm den Schläger, er lehnt dort schon länger, als du hier bist.",
    "quest.shell-hoard.afterwards":
      "Du hast die hundert geschafft. Über die hundert reden wir nicht. Bring mir mehr Muscheln.",
    "quest.scrap-wreck.name": "Was uns versenkt hat",
    "quest.scrap-wreck.objective": "Sally 8 Schrott bringen",
    "quest.scrap-wreck.offer":
      "Du hast Hände und ich habe einen Detektor übrig. Unter diesem Boden liegt Metall und ich will alles davon. Acht Stücke zum Anfang. Ich habe eine Theorie, wie wir hier gelandet sind, und die braucht Belege, keine Meinungen.",
    "quest.scrap-wreck.accepted":
      "Acht. Geh langsam. Das Ding klickt schneller, je näher du bist, und die Leute laufen immer zu schnell.",
    "quest.scrap-wreck.progress": "{done} von {target}. Such weiter, es liegt irgendwo unter dir.",
    "quest.scrap-wreck.done":
      "Rumpfplatte. Nieten sauber abgeschert, nicht gerissen. Das sind keine Felsen, das ist etwas, das uns getroffen hat. Wir sind nicht aufgelaufen. Jemand hat uns hierher gebracht.",
    "quest.scrap-wreck.afterwards":
      "Die Platte liegt im Regal. Ich sehe sie öfter an, als gesund ist.",
    "quest.scrap-golf.name": "Woher der Platz kam",
    "quest.scrap-golf.objective": "Sally 12 Schrott bringen",
    "quest.scrap-golf.offer":
      "Nächste Frage, und es ist die, die mich wachhält. Neun Löcher, gemäht, befahnt, gepflegt. So etwas baut niemand aus Versehen nach einem Schiffbruch. Zwölf weitere Stücke.",
    "quest.scrap-golf.accepted": "Zwölf. Und achte auf alles mit Prägung, Prägungen tragen Daten.",
    "quest.scrap-golf.progress": "{done} von {target}. Vor allem geprägte Stücke.",
    "quest.scrap-golf.done":
      "Eine Fahnenhalterung. Dieselbe Legierung wie der Rumpf. Sie haben den Platz aus dem Schiff gebaut, das heißt, sie warteten nicht auf Rettung. Sie richteten sich ein.",
    "quest.scrap-golf.afterwards":
      "Der Platz besteht aus dem Schiff. Ich weiß noch nicht, was ich davon halte, ihn zu spielen.",
    "quest.scrap-others.name": "Die davor",
    "quest.scrap-others.objective": "16 Knochen für Sally finden",
    "quest.scrap-others.offer":
      "Auf dieser Insel liegen Knochen, und keiner davon ist frisch. Sechzehn Stück. Ich will wissen, ob wir die erste Besatzung sind, der das passiert ist, und ich ahne die Antwort.",
    "quest.scrap-others.accepted":
      "Sechzehn. Wenn du etwas mit einem Namen findest, lies ihn nicht vor. Bring es einfach.",
    "quest.scrap-others.progress": "{done} von {target}. Bring es, lies es nicht.",
    "quest.scrap-others.done":
      "Drei Namensschilder. Drei verschiedene Schiffe. Vierzig Jahre auseinander. Wir sind nicht die Ersten, und so wie es aussieht, auch nicht die Letzten.",
    "quest.scrap-others.afterwards":
      "Drei Schiffe. Die Schilder bewahre ich getrennt von allem anderen auf.",
    "quest.scrap-signal.name": "Etwas zum Rufen",
    "quest.scrap-signal.objective": "Sally 20 Schrott bringen",
    "quest.scrap-signal.offer":
      "Genug Geschichte. Zwanzig Stücke und ich baue aus dem, was da unten liegt, einen Sender. Der Leuchtturm hat Strom, und niemand hat je etwas anderes als Licht von ihm verlangt.",
    "quest.scrap-signal.accepted":
      "Zwanzig. Kupfer, falls du den Unterschied siehst, und das tust du wahrscheinlich nicht, also bring alles.",
    "quest.scrap-signal.progress": "{done} von {target}. Alles. Ich sortiere es.",
    "quest.scrap-signal.done":
      "Er sendet. Geantwortet hat nichts, aber er sendet, und das ist der erste ehrliche Hoffnungsschimmer, den diese Insel hervorgebracht hat.",
    "quest.scrap-signal.afterwards":
      "Er sendet immer noch. Irgendwer wird es hören. Irgendwer muss.",
    "quest.scrap-mechanism.name": "Der Mechanismus",
    "quest.scrap-mechanism.objective": "Sally 25 Schrott bringen",
    "quest.scrap-mechanism.offer":
      "Die letzte, und sie ist eher für dich als für mich. Fünfundzwanzig Stücke und ich baue dir daraus einen Schläger. Zahnräder, ein richtig gewuchteter Kopf, alles. Betrachte es als Lohn.",
    "quest.scrap-mechanism.accepted": "Fünfundzwanzig. Ich wollte das bauen, seit ich hier bin.",
    "quest.scrap-mechanism.progress":
      "{done} von {target}. Er klickt, wenn du ihn ausrichtest. Das ist Absicht.",
    "quest.scrap-mechanism.done":
      "Da. Jedes Teil davon kam aus dem Boden, über den du gelaufen bist. Es ist das Beste, was ich gebaut habe, und ich habe es aus einem Wrack gebaut. Nimm ihn.",
    "quest.scrap-mechanism.afterwards":
      "Du trägst mein bestes Stück. Versuch, es auf dem fünften nicht im Wasser zu lassen.",
    "quest.coconut-hundred.name": "Fallobst",
    "quest.coconut-hundred.objective": "Coconutty {n} heruntergefallene Kokosnüsse geben",
    "quest.coconut-hundred.offer":
      "Hundert. Vom Boden, wohlgemerkt, mir klettert niemand auf die Bäume, sie sind alt und ich hänge an ihnen. Schaff das und ich mache dir aus einer einen Ball. Er fliegt weiter, als ihm zusteht, und er riecht unglaublich.",
    "quest.coconut-hundred.accepted":
      "Hundert. Unter den Palmen, vom Boden, in deine Hände, in meine. Das ist die ganze Methode.",
    "quest.coconut-hundred.progress.none":
      "Noch keine. Sie liegen unter den Bäumen. Dahin gehen sie, wenn sie aufhören, in den Bäumen zu sein.",
    "quest.coconut-hundred.progress":
      "{done}. Noch {left}. Sechs Bäume. Die sind nicht schüchtern.",
    "quest.coconut-hundred.done":
      "Genau hundert, und ich musste kein einziges Mal klettern. Hier, ein Ball, Schale dran. Er rollt nicht gerade, und das soll er auch nicht.",
    "quest.coconut-hundred.afterwards":
      "Du hast die hundert geschafft. Bring sie trotzdem weiter, ich zahle weiter.",
    "quest.blender-blades.name": "Etwas zum Häckseln",
    "quest.blender-blades.objective": "Sally 10 Schrott abschwatzen",
    "quest.blender-blades.offer":
      "Also. Klingen. In der Höhle den Strand hoch sitzt eine Frau auf mehr zerschnittenem Metall, als irgendwer braucht, und sie schuldet mir einen Hut. Zehn Stücke durch ihre Hände und sie weiß, welche zehn ich meine.",
    "quest.blender-blades.accepted":
      "Zehn. Sag ihr, es ist für den Drink, dann hört sie mit den Fragen auf.",
    "quest.blender-blades.progress":
      "{done} von {target}. Sie ist in der Höhle. Sie ist immer in der Höhle.",
    "quest.blender-blades.done":
      "Klingen. Scharfe. Fass da nicht rein, und eigentlich müsste ich das nicht sagen.",
    "quest.blender-blades.afterwards":
      "Die Klingen sind drin. Das war der leichte Teil, was man immer sagt, bevor der schwere kommt.",
    "quest.blender-vessel.name": "Etwas zum Hineinhäckseln",
    "quest.blender-vessel.objective": "Coconutty {n} weitere Kokosnüsse für den Krug bringen",
    "quest.blender-vessel.offer":
      "Jetzt etwas zum Hineinhäckseln. Zwölf weitere, dann höhle ich die größte aus und behalte den Rest für die Mischung. Ein Glaskrug auf einer Insel ist ein Krug, den du zusammenkehrst. Eine Kokosnuss lässt du fallen und sie springt.",
    "quest.blender-vessel.accepted":
      "Zwölf. Ich gehe sie durch, also bring mir keine aufgeplatzten.",
    "quest.blender-vessel.progress":
      "{done} von {target}. Eine davon wird ein Krug und weiß es noch nicht.",
    "quest.blender-vessel.done":
      "Das ist der Krug. Sieh ihn dir an. Ein besserer Krug als alles, was ich vor dem Untergang besaß.",
    "quest.blender-vessel.afterwards":
      "Klingen und ein Krug. Bleibt der Teil, der sich tatsächlich dreht.",
    "quest.blender-motor.name": "Der alte Motor",
    "quest.blender-motor.objective": "Den alten Motor aus dem Höhlenboden graben",
    "quest.blender-motor.offer":
      "Letztes Teil, und es ist das, das niemand hat. In dieser Höhle liegt ein Motor, vom Schiff, von irgendwas, ist mir egal, und er liegt mit allem anderen unter dem Boden. Nimm den Detektor. Bring mir das schwere Ding.",
    "quest.blender-motor.accepted":
      "Ein Motor. Du erkennst ihn beim Ausgraben. Er klingt nicht wie der übrige Kram.",
    "quest.blender-motor.progress":
      "Liegt noch da unten. Such das hintere Ende der Höhle ab, weg von der Stelle, die sie durchwühlt hat.",
    "quest.blender-motor.done":
      "Das ist er. Genau der. Gib mir eine Stunde.\n\nSo. Klingen, ein Krug und etwas, das sie dreht. Komm wieder, wenn du Durst hast, der erste geht aufs Haus und jeder danach nicht.",
    "quest.blender-motor.afterwards":
      "Die Bar ist offen. Frag mich nach einem Drink und pass danach auf dich auf, das haut Leute um."
  },
  fr: {
    // ---- The Quartermaster asks for skill ----------------------------------
    "quest.five-aces.name": "Cinq As",
    "quest.five-aces.objective": "Rentre le green d’entraînement en un coup",
    "quest.five-aces.offer":
      "Tu veux quelque chose à faire en attendant ? Tiens. Le green d’entraînement, six mètres cinquante, tout droit. Rentre-la en un coup. Fais-le cinq fois et je te revaudrai ça.",
    "quest.five-aces.accepted": "Cinq. Pas quatre. Je compterai même si toi tu ne comptes pas.",
    "quest.five-aces.progress.none": "Pas une seule. Il en reste cinq.",
    "quest.five-aces.progress":
      "{done} sur {target}. Encore {left}, et non, celles que tu as failli rentrer ne comptent pas.",
    "quest.five-aces.done": "Cinq. Je les ai toutes vues. Prends ça.",
    "quest.five-aces.afterwards": "Tu me l’as déjà pris une fois. Va chercher plus dur.",
    "quest.three-aces.name": "Trois As",
    "quest.three-aces.objective": "Rentre trois trous en un dans la même partie",
    "quest.three-aces.offer":
      "Trois trous en un. La même partie, pas trois après-midi à un chacun. Fais ça et le club au drapeau accroché au mur est à toi.",
    "quest.three-aces.accepted": "Trois. Dans une partie. Je le saurai.",
    "quest.three-aces.progress":
      "Toujours trois dans une partie. Et non, le green d’entraînement ne compte pas.",
    "quest.three-aces.done": "Trois. Dans une partie. Le Club au Drapeau est à toi.",
    "quest.three-aces.afterwards": "Tu portes le drapeau maintenant. Il n’y a rien à ajouter.",
    "quest.under-par.name": "Sous le Par",
    "quest.under-par.objective": "Termine les neuf sous le par",
    "quest.under-par.offer":
      "Les neuf entiers, sous le par. Pas dans le par. Sous. Personne n’y est arrivé ce mois-ci et j’aimerais que ça change.",
    "quest.under-par.accepted": "Sous. Dans le par, ce n’est pas sous.",
    "quest.under-par.progress": "Sous le par sur les neuf. C’est le par exact qui piège les gens.",
    "quest.under-par.done": "Sous le par. Sur ce parcours. Je vais en parler autour de moi.",
    "quest.under-par.afterwards":
      "Tu es passé sous le par une fois. Je ne l’ai pas oublié, et toi non plus.",
    "quest.all-eights.name": "Rien que des Huit",
    "quest.all-eights.objective": "Fais exactement huit coups à chaque trou",
    "quest.all-eights.offer":
      "Huit coups. Chaque trou. Pas sept sur le facile, pas neuf quand elle t’échappe. Huit, neuf fois. Il y a une balle derrière le bar pour qui y arrive.",
    "quest.all-eights.accepted": "Huit. À chacun. Ceux-là aussi, je les compte.",
    "quest.all-eights.progress": "Huit à chaque trou. Un sept gâche tout, et un neuf aussi.",
    "quest.all-eights.done":
      "Neuf huit. C’est pire que bien jouer et bien plus dur. La Balle 8 est à toi.",
    "quest.all-eights.afterwards": "Tu as fait les huit. Une fois suffit.",
    "quest.all-nine-lost.name": "Jusqu’à la Dernière",
    "quest.all-nine-lost.objective": "Épuise tes coups sur les neuf trous",
    "quest.all-nine-lost.offer":
      "En voilà une que personne ne demande. Perds ta balle sur les neuf. Chaque trou, coups épuisés. Fais ça et je te trouverai quelque chose de rond et de lourd.",
    "quest.all-nine-lost.accepted": "Les neuf. Essaie de ne pas y prendre goût.",
    "quest.all-nine-lost.progress": "Les neuf, coups épuisés sur chacun. En rentrer un gâche tout.",
    "quest.all-nine-lost.done":
      "Pas un seul terminé. Tiens. C’est un boulet de canon. Il te va bien.",
    "quest.all-nine-lost.afterwards": "Tu as perdu les neuf une fois. Restons-en là.",
    "quest.secret-eight.name": "Le Dixième",
    "quest.secret-eight.objective": "Rentre le trou secret en {n} coups ou moins",
    "quest.secret-eight.offer":
      "Bien. Il y a un dixième trou. Après le neuvième, par-derrière, et non, il n’est pas sur la carte. Rentre-la en {n} et je te donne les deux choses de cette boutique auxquelles je n’ai jamais su mettre un prix. Tu n’y accéderas pas avant le niveau {level}, cela dit. Considère que c’est le principe.",
    "quest.secret-eight.accepted": "{n} ou moins. Je le saurai, et ne me demande pas comment.",
    "quest.secret-eight.progress":
      "Toujours debout. Va voir après le neuvième. Tu le sauras quand le sol cessera d’être un parcours de golf.",
    "quest.secret-eight.done":
      "Tu l’as trouvé et tu l’as battu. Personne ne fait les deux.\n\nTiens. Le Club Néon et la Balle Néon, et je tiens à préciser que je ne te les ai pas vendus.",
    "quest.secret-eight.afterwards":
      "Tu as rentré le dixième. Il ne reste rien ici que tu n’aies pas gagné.",
    // ---- Shellman, Sally and Coconutty -------------------------------------
    "quest.shell-hoard.name": "Les Cent",
    "quest.shell-hoard.objective": "Donne {n} coquillages à Shellman",
    "quest.shell-hoard.offer":
      "Tu as des mains. Bien. Il me faut cent coquillages, et ceux-là je les ai déjà comptés, alors ne me les propose pas. Cent. Pas quatre-vingt-dix-neuf. J’ai déjà été à quatre-vingt-dix-neuf et je n’ai pas aimé.",
    "quest.shell-hoard.accepted":
      "Cent. C’est moi qui tiens le compte. Je tiens toujours le compte.",
    "quest.shell-hoard.progress.none":
      "Zéro. Un zéro net. Il y a quelque chose de presque reposant dans un zéro net.",
    "quest.shell-hoard.progress":
      "{done}. Il en manque {left}. Je les dis à voix haute la nuit, je saurais donc si tu mentais.",
    "quest.shell-hoard.done":
      "Cent. Exactement cent. Prends le club, il est appuyé là depuis avant ton arrivée.",
    "quest.shell-hoard.afterwards":
      "Tu as fait les cent. On ne parle pas des cent. Apporte-moi d’autres coquillages.",
    "quest.scrap-wreck.name": "Ce Qui Nous a Coulés",
    "quest.scrap-wreck.objective": "Apporte 8 ferrailles à Sally",
    "quest.scrap-wreck.offer":
      "Tu as des mains et j’ai un détecteur en trop. Il y a du métal sous ce sol et je le veux tout. Huit morceaux pour commencer. J’ai une théorie sur la façon dont on a atterri ici et elle a besoin de preuves, pas d’avis.",
    "quest.scrap-wreck.accepted":
      "Huit. Balaie lentement. Le truc clique plus vite quand tu approches, et les gens marchent toujours trop vite.",
    "quest.scrap-wreck.progress":
      "{done} sur {target}. Continue à balayer, c’est quelque part sous toi.",
    "quest.scrap-wreck.done":
      "Plaque de coque. Rivets cisaillés net, pas arrachés. Ce ne sont pas des rochers, c’est quelque chose qui nous a heurtés. On ne s’est pas échoués. Quelqu’un nous a mis ici.",
    "quest.scrap-wreck.afterwards":
      "La plaque est sur l’étagère. Je la regarde plus souvent qu’il ne faudrait.",
    "quest.scrap-golf.name": "D’où Vient le Parcours",
    "quest.scrap-golf.objective": "Apporte 12 ferrailles à Sally",
    "quest.scrap-golf.offer":
      "Question suivante, et c’est celle qui me tient éveillée. Neuf trous, tondus, avec des drapeaux, entretenus. Personne ne construit ça par accident après un naufrage. Douze morceaux de plus.",
    "quest.scrap-golf.accepted":
      "Douze. Et cherche tout ce qui est estampillé, les estampilles portent des dates.",
    "quest.scrap-golf.progress": "{done} sur {target}. Surtout les morceaux estampillés.",
    "quest.scrap-golf.done":
      "Un support de drapeau. Le même alliage que la coque. Ils ont construit le parcours avec le navire, ce qui veut dire qu’ils n’attendaient pas les secours. Ils s’installaient.",
    "quest.scrap-golf.afterwards":
      "Le parcours est fait du navire. Je ne sais pas encore ce que ça me fait d’y jouer.",
    "quest.scrap-others.name": "Ceux d’Avant",
    "quest.scrap-others.objective": "Trouve 16 os pour Sally",
    "quest.scrap-others.offer":
      "Il y a des os sur cette île et aucun n’est récent. Seize morceaux. Je veux savoir si nous sommes le premier équipage à qui c’est arrivé, et je crains de connaître la réponse.",
    "quest.scrap-others.accepted":
      "Seize. Si tu trouves quelque chose avec un nom dessus, ne le lis pas à voix haute. Apporte-le, c’est tout.",
    "quest.scrap-others.progress": "{done} sur {target}. Apporte-le, ne le lis pas.",
    "quest.scrap-others.done":
      "Trois plaques nominatives. Trois navires différents. Quarante ans d’écart. Nous ne sommes pas les premiers et, au train où vont les choses, pas les derniers.",
    "quest.scrap-others.afterwards": "Trois navires. Je garde les plaques à part de tout le reste.",
    "quest.scrap-signal.name": "De Quoi Crier",
    "quest.scrap-signal.objective": "Apporte 20 ferrailles à Sally",
    "quest.scrap-signal.offer":
      "Assez d’histoire. Vingt morceaux et je peux monter un émetteur avec ce qu’il y a là-dessous. Le phare a du courant et personne ne lui a jamais demandé autre chose que de la lumière.",
    "quest.scrap-signal.accepted":
      "Vingt. Du cuivre si tu sais faire la différence, et ce n’est probablement pas le cas, alors apporte tout.",
    "quest.scrap-signal.progress": "{done} sur {target}. Tout. Je trierai.",
    "quest.scrap-signal.done":
      "Il émet. Rien n’a répondu, mais il émet, et c’est le premier espoir honnête que cette île ait produit.",
    "quest.scrap-signal.afterwards": "Il émet toujours. Quelqu’un l’entendra. Il le faut bien.",
    "quest.scrap-mechanism.name": "Le Mécanisme",
    "quest.scrap-mechanism.objective": "Apporte 25 ferrailles à Sally",
    "quest.scrap-mechanism.offer":
      "La dernière, et elle est pour toi plutôt que pour moi. Vingt-cinq morceaux et je t’en fabrique un club. Des engrenages, une tête correctement lestée, tout. Considère ça comme un salaire.",
    "quest.scrap-mechanism.accepted":
      "Vingt-cinq. J’ai envie de construire ça depuis le jour où je suis arrivée.",
    "quest.scrap-mechanism.progress":
      "{done} sur {target}. Il cliquera quand tu l’aligneras. C’est voulu.",
    "quest.scrap-mechanism.done":
      "Voilà. Chaque pièce est sortie du sol que tu as arpenté. C’est la meilleure chose que j’aie faite et je l’ai faite avec une épave. Prends-le.",
    "quest.scrap-mechanism.afterwards":
      "Tu portes mon meilleur travail. Essaie de ne pas le perdre dans l’eau au cinquième.",
    "quest.coconut-hundred.name": "Aubaine",
    "quest.coconut-hundred.objective": "Donne {n} noix de coco tombées à Coconutty",
    "quest.coconut-hundred.offer":
      "Cent. Ramassées au sol, attention, je ne veux personne dans mes arbres, ils sont vieux et j’y tiens. Fais ça et je t’en ferai une balle. Elle va plus loin qu’elle ne le devrait et elle sent incroyablement bon.",
    "quest.coconut-hundred.accepted":
      "Cent. Sous les palmiers, au sol, dans tes mains, dans les miennes. C’est toute la méthode.",
    "quest.coconut-hundred.progress.none":
      "Aucune pour l’instant. Elles sont sous les arbres. C’est là qu’elles vont quand elles cessent d’être dans les arbres.",
    "quest.coconut-hundred.progress": "{done}. Encore {left}. Six arbres. Ils ne sont pas timides.",
    "quest.coconut-hundred.done":
      "Exactement cent, et je n’ai pas eu à grimper une seule fois. Tiens, une balle, bourre comprise. Elle ne roulera pas droit et je ne le voudrais pas.",
    "quest.coconut-hundred.afterwards":
      "Tu as fait les cent. Continue à en apporter, je paierai quand même.",
    "quest.blender-blades.name": "De Quoi Hacher",
    "quest.blender-blades.objective": "Fais lâcher 10 ferrailles à Sally",
    "quest.blender-blades.offer":
      "Bon. Des lames. Il y a une femme dans la grotte en haut de la plage assise sur plus de métal découpé qu’il n’en faut, et elle me doit un chapeau. Dix morceaux passés par ses mains et elle saura de quels dix je parle.",
    "quest.blender-blades.accepted":
      "Dix. Dis-lui que c’est pour la boisson et elle arrêtera de poser des questions.",
    "quest.blender-blades.progress":
      "{done} sur {target}. Elle est dans la grotte. Elle est toujours dans la grotte.",
    "quest.blender-blades.done":
      "Des lames. Bien aiguisées. N’y mets pas la main, et je ne devrais pas avoir à le dire.",
    "quest.blender-blades.afterwards":
      "Les lames sont en place. C’était la partie facile, ce qu’on dit toujours avant la partie difficile.",
    "quest.blender-vessel.name": "De Quoi Hacher Dedans",
    "quest.blender-vessel.objective": "Apporte {n} noix de coco de plus à Coconutty pour le pichet",
    "quest.blender-vessel.offer":
      "Maintenant, de quoi hacher dedans. Douze de plus, je creuserai la plus grosse et je garderai le reste pour le mélange. Un pichet en verre sur une île, c’est un pichet qu’on finit par balayer. Une noix de coco, tu la lâches et elle rebondit.",
    "quest.blender-vessel.accepted":
      "Douze. Je vais les trier, alors ne m’apporte pas celles qui sont fendues.",
    "quest.blender-vessel.progress":
      "{done} sur {target}. L’une d’elles va devenir un pichet et elle ne le sait pas encore.",
    "quest.blender-vessel.done":
      "Voilà le pichet. Regarde-le. C’est un meilleur pichet que tout ce que j’avais avant que le bateau coule.",
    "quest.blender-vessel.afterwards":
      "Des lames et un pichet. Reste la pièce qui tourne vraiment.",
    "quest.blender-motor.name": "Le Vieux Moteur",
    "quest.blender-motor.objective": "Déterre le vieux moteur du sol de la grotte",
    "quest.blender-motor.offer":
      "Dernière pièce, et c’est celle que personne n’a. Il y a un moteur dans cette grotte, du navire, de quelque chose, peu m’importe, et il est sous le sol avec tout le reste. Prends le détecteur. Rapporte-moi la chose lourde.",
    "quest.blender-motor.accepted":
      "Un moteur. Tu le reconnaîtras en le déterrant. Il ne sonnera pas comme le reste de la ferraille.",
    "quest.blender-motor.progress":
      "Toujours là-dessous. Balaie le fond de la grotte, loin de là où elle a fouillé.",
    "quest.blender-motor.done":
      "C’est lui. C’est bien lui. Donne-moi une heure.\n\nVoilà. Des lames, un pichet, et de quoi les faire tourner. Reviens quand tu auras soif, le premier est offert et tous les suivants non.",
    "quest.blender-motor.afterwards":
      "Le bar est ouvert. Demande-moi un verre et fais attention après, ça échappe aux gens."
  }
}
