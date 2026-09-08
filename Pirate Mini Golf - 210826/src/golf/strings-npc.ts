/**
 * The five characters.
 *
 * Data only, like the other table files: nothing is imported here, so nothing
 * in here can break, and it can be handed to a translator as it stands.
 *
 * ---------------------------------------------------------------------------
 * On translating these particular people
 * ---------------------------------------------------------------------------
 * They are the reason anybody stays on the island, and a literal rendering
 * kills all five of them. Salt is chatty and slightly put-upon. Shellman is
 * cold and pedantic and would rather you left. Sally is an academic with a
 * shipwreck problem. The Quartermaster is running a business. Coconutty has
 * decided that being marooned is a posting.
 *
 * So these are translated for who is speaking rather than for what the words
 * are, and every one of them uses the informal second person in all three
 * languages: tu, du, tu. Not one of these people would address you as usted,
 * Sie or vous, and using it would make them strangers.
 *
 * ---------------------------------------------------------------------------
 * Plurals
 * ---------------------------------------------------------------------------
 * The English branches on the count in a handful of places, and where it does
 * there are two ids rather than one clever one: `.one` and `.many`. Doing it
 * with a suffix works in English and falls apart everywhere else, and a
 * plural-rules engine is a lot of machinery for the nine lines that need it.
 */

export const NPCS: Record<string, Record<string, string>> = {
  en: {
    // ---- Salt, behind the counter at Putts 'n' Balls -----------------------
    "salt.greeting":
      "Hi, the names Salt, I've been running Putts 'n' Balls for years! Mini golf on an Island? Bit weird... but lets not ask questions. You're using a {ball}, and you've {pp} {ppShort} to your name. Feel free to get new gear here, once you level up!",
    "salt.showBalls": "Show me the balls",
    "salt.showClubs": "Show me the clubs",
    "salt.wherePoints": "Where do points come from?",
    "salt.justPassing": "Just passing",
    "salt.points":
      "Play the nine. Finishing pays, and playing well pays better: pars, birdies, and the odd hole in one. Points are called {ppLong} and can be used to upgrade your gear or spent elsewhere within the Pixel Arcade ecosystem.",
    "salt.fairEnough": "Fair enough",
    // ---- Cave Explorer Sally -----------------------------------------------
    "sally.greet.noDetector":
      "Finally, sign of life! You are the first person to come into the cave in months. I need someone with a strong back and no strong opinions about digging.",
    "sally.greet.none":
      "Nothing on you. The floor here is full of it, sweep slowly and let the thing click. People always walk too fast and then tell me the cave is empty.",
    "sally.greet.one": "{n} piece on you. Hand it over and I will see what it wants to be.",
    "sally.greet.many": "{n} pieces on you. Hand it over and I will see what it wants to be.",
    "sally.takeDetector": "Take the detector",
    "sally.handOver": "Hand over {n}",
    "sally.whatDoing": "What are you doing out here?",
    "sally.howWorks": "How does the detector work?",
    "sally.letYouGetOn": "I will let you get on",
    "sally.given":
      "Sling it low and walk. Take good care of her, she is the best metal detector I have ever had. It clicks when there is metal within about fifteen metres. Faster the tick the closer you are to the gold, or in this case, scrap! ",
    "sally.givenPhone":
      "Tap the putter button and dig. Tap the + button to stow your detector when the clicking gets on your nerves, which it will.",
    "sally.givenKey":
      "Press E and dig. Press 3 to stow your detector when the clicking gets on your nerves, which it will.",
    "sally.whatLooking": "What are you looking for?",
    "sally.right": "Right",
    "sally.handed":
      "That is the lot. {total}  Some of it is rubbish. Some of it is not, and telling the difference is the only thing I am good at.",
    "sally.whatWorkedOut": "What have you worked out?",
    "sally.backToIt": "Back to it",
    "sally.why":
      "Three things, in order. Why a ship that size went down in water this calm and where did the ship go. Where a full nine-hole golf course came from on an island with no port. And how anybody gets off it, because in eleven months I have not seen one boat that was not already wrecked.",
    "sally.anyAnswers": "Do you have any answers?",
    "sally.grim": "Grim",
    "sally.answers.none":
      "None whatsoever. That is rather the problem, and why you are holding a detector.",
    "sally.answers.early":
      "I working on something special for you. The metal in the cave did not get bent by rocks, I will say that much.",
    "sally.answers.some":
      "Enough to know the course and the ship are the same metal, which raises more questions than it settles.",
    "sally.answers.most": "More than I want. Ask me over a proper drink and I will tell you.",
    "sally.anythingIcanDo": "Anything I can do?",
    "sally.fairEnough": "Fair enough",
    "sally.howto":
      "It reaches about {range} metres and you can dig once you are within {dig} of a thing. Slow clicks mean something is out there, fast clicks mean it is under you. It is weird, a dug spot fills back in after a while, the sea keeps putting things back, not sure why!",
    "sally.gotIt": "Got it",
    // ---- Shellman ----------------------------------------------------------
    "shellman.greet.none":
      "Hello there traveller. You do not appear to be carrying any shells. They are on the sand, I am far to important to be looking for them myself, I will reward you if you collect them.",
    "shellman.greet.full":
      "You have {n}. I have had my {limit} today and I have written them down. Come back tomorrow.",
    "shellman.greet.one": "{n} shell. I can take {room} more today. Mind your own business.",
    "shellman.greet.many": "{n} shells. I can take {room} more today. Mind your own business.",
    "shellman.handOver": "Hand over {n}",
    "shellman.whyShells": "Why shells?",
    "shellman.howMany": "How many have I given you?",
    "shellman.leaveYou": "I will leave you to it",
    "shellman.handed":
      "He takes them without looking, turns each one over once, and puts it somewhere you cannot see. \"Counted,\" he says. \"All of them counted.\"",
    "shellman.handedSilent":
      "He holds his hands out, and keeps holding them out. Nothing passes between you. (The server has not answered. Check the console for \"[golf] LEDGER SILENT\".)",
    "shellman.whatDoYouDo": "What do you do with them?",
    "shellman.right": "Right",
    "shellman.why":
      "A shell is a house somebody finished with. Somebody very small, who did not leave a note. I keep them because it seems rude that nobody else does. That is the entire reason and I have never had a better one.",
    "shellman.doYouStop": "Do you ever stop?",
    "shellman.fairEnough": "Fair enough",
    "shellman.stop":
      "I take {limit} a day. Not because I want {limit}. Because past {limit} I stop seeing them, and a shell you have stopped seeing may as well still be on the beach.",
    "shellman.reasonable": "That is... reasonable",
    "shellman.tally.none": "None. Not one. I would remember.",
    "shellman.tally.short":
      "{total}. Here is {total} because I counted it {total} times. {left} short of the hundred.",
    "shellman.tally.past": "{total}. Past the hundred. We agreed not to speak of the hundred.",
    "shellman.whyHundred": "Why a hundred?",
    "shellman.thanks": "Thanks",
    // ---- The Quartermaster -------------------------------------------------
    "qm.greet": "Welcome to the Shack. {stats} {field}",
    "qm.stats.practiceSome": "You've managed to hole {n} on the practice green.",
    "qm.stats.notSignedOn": "You've not signed on yet.",
    "qm.stats.noHoles": "You're on hole {n} and yet to hole one out.",
    "qm.stats.oneHole": "{holes} hole down, {total} shots, {par}.",
    "qm.stats.holes": "{holes} holes down, {total} shots, {par}.",
    "qm.par.level": "level par",
    "qm.par.over": "{n} over",
    "qm.par.under": "{n} under",
    "qm.field.none": "Nobody signed up at the moment. The course is yours.",
    "qm.field.justYou": "Just you out there so far.",
    "qm.field.onePlayer": "One player out on the course.",
    "qm.field.many": "{n} out on the course right now.",
    "qm.howDoIPlay": "How do I play?",
    "qm.whatsCourse": "What's the course like?",
    "qm.nothingForNow": "Nothing for now",
    "qm.howtoPhone":
      "Walk to your ball and tap the putter button. Aim where you want the ball to go and confirm. Once the power meter has started, confirm your desired strength by tapping again. Attempt to hit the white line within the green zone. Miss and the ball will veer left or right.",
    "qm.howtoKey":
      "Walk to your ball and press E. Aim where you want the ball to go and confirm. Once the power meter has started, confirm your desired strength by tapping again. Attempt to hit the white line within the green zone. Miss and the ball will veer left or right.",
    "qm.messUp": "What if I make a mess up my shot?",
    "qm.whereStart": "Where do I start?",
    "qm.gotIt": "Got it",
    "qm.cancelPhone":
      "The X button cancels your swing, stepping you away from the ball altogether. Nothing is on your card until the ball is struck. To reset your ball, head to your backpack.",
    "qm.cancelKey":
      "F cancels your swing, stepping you away from the ball altogether. Nothing is on your card until the ball is struck. To reset your ball, head to your backpack.",
    "qm.thanks": "Thanks",
    "qm.where":
      "The practice green is right here, in the shack. When you fancy playing properly, sign on at the board by the first tee and play the nine.",
    "qm.rightYouAre": "Right you are",
    "qm.course":
      "{holes} holes, par {par}. Ramps, a barrel that will not sit still, a lift on the last that waits for nobody, and a lighthouse that has ruined better players than you.",
    "qm.takeChances": "I will take my chances",
    // ---- Coconutty ---------------------------------------------------------
    "coco.greet.drinkOne":
      "You have got one in you already. {n} minute of it left, near enough. Go and enjoy it. Standing still is a waste of a colada.",
    "coco.greet.drinkMany":
      "You have got one in you already. {n} minutes of it left, near enough. Go and enjoy it. Standing still is a waste of a colada.",
    "coco.greet.none":
      "Where's my sweet sweet coconuts man, you dont seem to have any on you? There are loads of palm trees on this island and every one of them is dropping them faster than I can pick them up, which is the only labour shortage I have ever been glad about.",
    "coco.greet.full":
      "{n} on you and nowhere to put them. I have had my {limit} today. Any more and they go off before I get to them, and a coconut that has gone off is a smell you remember.",
    "coco.greet.one":
      "{n} coconut. I can take {room} more today. Off the ground, I hope. I meant that about the trees.",
    "coco.greet.many":
      "{n} coconuts. I can take {room} more today. Off the ground, I hope. I meant that about the trees.",
    "coco.handOver": "Hand over {n}",
    "coco.forJug": "{n} for the jug",
    "coco.colada": "Pina colada ({price} {pp})",
    "coco.whyCoconuts": "Why coconuts?",
    "coco.howMany": "How many have I brought you?",
    "coco.cyaLater": "Cya later!",
    "coco.jug.waiting": "He starts sorting through them, and does not look up.",
    "coco.jug.more":
      "He turns each one over, taps it, and sets it down in a separate pile. \"{n} more and I have got a jug.\"",
    "coco.jug.done":
      "He picks through them, holds one up, and stops talking for a moment. \"That is the one. That is a jug.\"",
    "coco.whyACoconut": "Why a coconut?",
    "coco.right": "Right",
    "coco.handed":
      "He takes them two at a time, knocks each one against the next, and listens. \"That one is full,\" he says. Not specifing which.",
    "coco.handedSilent":
      "He puts his hands out and leaves them out. Nothing changes hands. (The server has not answered. Check the console for \"[golf] LEDGER SILENT\".)",
    "coco.whatDoYouDo": "What do you do with them?",
    "coco.poured.made":
      "He makes the drink it in the coconut, and hands it over without a straw. \"No straws,\" he says. \"Straws are the one thing the sea never gives back.\"",
    "coco.poured.pending": "He turns on the blender. The motor takes a moment to run.",
    "coco.poured.tooPoor":
      "He looks at you, then at the blender, then at you. \"{price},\" he says. \"I did say.\"",
    "coco.poured.silent":
      "He reaches for the jug and stops. (Nothing came back from the server. Check the console.)",
    "coco.whatIsInIt": "What is in it?",
    "coco.thanks": "Thanks",
    "coco.recipe":
      "Coconut, obviously. Pineapple, which I am not going to tell you where I get. Ice, which is the part that should worry you, and rum, which is the part that does not worry me at all. You will find you get about the place quicker afterwards. Have fun.",
    "coco.notHowItWorks": "That is not how any of that works",
    "coco.fairEnough": "Fair enough",
    "coco.works":
      "No. It is not. And yet.\n\nLook, I have been on this island eleven months, there is a woman in a cave who talks to metal, and a man on the south beach who has named some of the shells. The drink is the least of it.",
    "coco.goodPoint": "Good point",
    "coco.why":
      "Because they are free, they are everywhere, and they are the only thing here that is both food and a cup. Show me a shell that does that. Shellman cannot, and I have asked him, at length, more than once.",
    "coco.whatBuilding": "What are you building?",
    "coco.building.built":
      "Built it. Blades off a shipwreck, a jug out of a coconut, and a motor from the cave. It sounds like a war and it makes a beautiful drink.",
    "coco.building.not":
      "A blender. Three parts and I have got none of them: something to chop with, something to chop in! Can you help me get them please.",
    "coco.tally.none": "None. You have brought me none. I am not counting that against you yet.",
    "coco.tally.short":
      "{total}. {left} short of the hundred, and the hundred is where the ball is.",
    "coco.tally.past":
      "{total}. Past the hundred. You are now bringing me coconuts for the love of it, which I respect.",
    "coco.whyHundred": "Why a hundred?"
  },
  es: {
    // ---- Salt, behind the counter at Putts 'n' Balls -----------------------
    "salt.greeting":
      "Hola, me llamo Salt, llevo años al frente de Putts ’n’ Balls. ¿Minigolf en una isla? Un poco raro... pero mejor no preguntar. Vas con una {ball}, y tienes {pp} {ppShort} a tu nombre. Cuando subas de nivel pásate por aquí y te pongo algo mejor.",
    "salt.showBalls": "Enséñame las bolas",
    "salt.showClubs": "Enséñame los palos",
    "salt.wherePoints": "¿De dónde salen los puntos?",
    "salt.justPassing": "Solo pasaba por aquí",
    "salt.points":
      "Juega los nueve. Terminar paga, y jugar bien paga mejor: pares, birdies y algún hoyo en uno. Los puntos se llaman {ppLong} y sirven para mejorar tu equipo o para gastarlos en el resto del ecosistema Pixel Arcade.",
    "salt.fairEnough": "Me vale",
    // ---- Cave Explorer Sally -----------------------------------------------
    "sally.greet.noDetector":
      "Por fin, señales de vida. Eres la primera persona que entra en la cueva en meses. Necesito a alguien de espalda fuerte y sin opiniones fuertes sobre cavar.",
    "sally.greet.none":
      "No llevas nada. El suelo está lleno, barre despacio y deja que la cosa haga clic. Todo el mundo anda demasiado rápido y luego me dice que la cueva está vacía.",
    "sally.greet.one": "{n} pieza encima. Dámela y veré en qué quiere convertirse.",
    "sally.greet.many": "{n} piezas encima. Dámelas y veré en qué quieren convertirse.",
    "sally.takeDetector": "Coger el detector",
    "sally.handOver": "Darle {n}",
    "sally.whatDoing": "¿Qué haces tú aquí?",
    "sally.howWorks": "¿Cómo funciona el detector?",
    "sally.letYouGetOn": "Te dejo seguir",
    "sally.given":
      "Llévalo bajo y camina. Cuídalo bien, es el mejor detector de metales que he tenido. Hace clic cuando hay metal a unos quince metros. Cuanto más rápido el tic, más cerca del oro, o en este caso, de la chatarra. ",
    "sally.givenPhone":
      "Toca el botón del putter y cava. Toca el botón + para guardarlo cuando el clic te ponga de los nervios, que lo hará.",
    "sally.givenKey":
      "Pulsa E y cava. Pulsa 3 para guardarlo cuando el clic te ponga de los nervios, que lo hará.",
    "sally.whatLooking": "¿Qué estás buscando?",
    "sally.right": "Vale",
    "sally.handed":
      "Eso es todo. {total}  Parte es basura. Parte no lo es, y distinguirlo es lo único que se me da bien.",
    "sally.whatWorkedOut": "¿Y qué has averiguado?",
    "sally.backToIt": "A seguir",
    "sally.why":
      "Tres cosas, por orden. Por qué se hundió un barco de ese tamaño en un mar tan tranquilo, y adónde fue a parar. De dónde salió un campo de golf de nueve hoyos en una isla sin puerto. Y cómo se sale de aquí, porque en once meses no he visto un solo barco que no estuviera ya naufragado.",
    "sally.anyAnswers": "¿Tienes alguna respuesta?",
    "sally.grim": "Qué panorama",
    "sally.answers.none":
      "Ninguna en absoluto. Ese es justo el problema, y por eso llevas un detector.",
    "sally.answers.early":
      "Estoy preparando algo especial para ti. El metal de la cueva no lo doblaron unas rocas, eso te lo digo.",
    "sally.answers.some":
      "Las suficientes para saber que el campo y el barco son el mismo metal, lo cual abre más preguntas de las que cierra.",
    "sally.answers.most":
      "Más de las que quisiera. Invítame a una copa en condiciones y te lo cuento.",
    "sally.anythingIcanDo": "¿Puedo hacer algo?",
    "sally.fairEnough": "Me vale",
    "sally.howto":
      "Alcanza unos {range} metros y puedes cavar cuando estés a {dig} de algo. Clics lentos, hay algo por ahí; clics rápidos, lo tienes debajo. Es raro, pero un sitio ya cavado se vuelve a llenar al rato. El mar sigue devolviendo cosas, no sé por qué.",
    "sally.gotIt": "Entendido",
    // ---- Shellman ----------------------------------------------------------
    "shellman.greet.none":
      "Hola, viajero. No parece que lleves ninguna concha. Están en la arena. Soy demasiado importante para buscarlas yo mismo, pero te recompensaré si las recoges.",
    "shellman.greet.full":
      "Llevas {n}. Ya he tenido mis {limit} de hoy y las tengo anotadas. Vuelve mañana.",
    "shellman.greet.one":
      "{n} concha. Hoy puedo aceptar {room} más. Y no te metas donde no te llaman.",
    "shellman.greet.many":
      "{n} conchas. Hoy puedo aceptar {room} más. Y no te metas donde no te llaman.",
    "shellman.handOver": "Darle {n}",
    "shellman.whyShells": "¿Por qué conchas?",
    "shellman.howMany": "¿Cuántas te he dado?",
    "shellman.leaveYou": "Te dejo con lo tuyo",
    "shellman.handed":
      "Las coge sin mirar, le da la vuelta a cada una una vez y la guarda donde no alcanzas a ver. \"Contadas\", dice. \"Todas contadas.\"",
    "shellman.handedSilent":
      "Extiende las manos, y las deja extendidas. No pasa nada entre vosotros. (El servidor no ha contestado. Mira la consola por \"[golf] LEDGER SILENT\".)",
    "shellman.whatDoYouDo": "¿Y qué haces con ellas?",
    "shellman.right": "Vale",
    "shellman.why":
      "Una concha es una casa de la que alguien terminó. Alguien muy pequeño, que no dejó nota. Las guardo porque me parece de mala educación que no lo haga nadie. Esa es toda la razón y nunca he tenido otra mejor.",
    "shellman.doYouStop": "¿Paras alguna vez?",
    "shellman.fairEnough": "Me vale",
    "shellman.stop":
      "Acepto {limit} al día. No porque quiera {limit}. Porque pasadas {limit} dejo de verlas, y una concha que has dejado de ver bien podría seguir en la playa.",
    "shellman.reasonable": "Eso es... razonable",
    "shellman.tally.none": "Ninguna. Ni una. Me acordaría.",
    "shellman.tally.short":
      "{total}. Aquí van {total} porque las conté {total} veces. Te faltan {left} para las cien.",
    "shellman.tally.past": "{total}. Pasadas las cien. Quedamos en no hablar de las cien.",
    "shellman.whyHundred": "¿Por qué cien?",
    "shellman.thanks": "Gracias",
    // ---- The Quartermaster -------------------------------------------------
    "qm.greet": "Bienvenido a la Cabaña. {stats} {field}",
    "qm.stats.practiceSome": "Has metido {n} en el green de prácticas.",
    "qm.stats.notSignedOn": "Todavía no te has apuntado.",
    "qm.stats.noHoles": "Vas por el hoyo {n} y aún no has metido ninguna.",
    "qm.stats.oneHole": "{holes} hoyo hecho, {total} golpes, {par}.",
    "qm.stats.holes": "{holes} hoyos hechos, {total} golpes, {par}.",
    "qm.par.level": "en el par",
    "qm.par.over": "{n} sobre par",
    "qm.par.under": "{n} bajo par",
    "qm.field.none": "Ahora mismo no hay nadie apuntado. El campo es tuyo.",
    "qm.field.justYou": "De momento solo estás tú ahí fuera.",
    "qm.field.onePlayer": "Un jugador en el campo.",
    "qm.field.many": "{n} en el campo ahora mismo.",
    "qm.howDoIPlay": "¿Cómo se juega?",
    "qm.whatsCourse": "¿Cómo es el campo?",
    "qm.nothingForNow": "Nada por ahora",
    "qm.howtoPhone":
      "Ve hasta tu bola y toca el botón del putter. Apunta adonde quieras mandarla y confirma. Cuando arranque la barra de fuerza, confirma la que quieras tocando otra vez. Intenta dar en la línea blanca dentro de la zona verde. Si fallas, la bola se irá a un lado.",
    "qm.howtoKey":
      "Ve hasta tu bola y pulsa E. Apunta adonde quieras mandarla y confirma. Cuando arranque la barra de fuerza, confirma la que quieras pulsando otra vez. Intenta dar en la línea blanca dentro de la zona verde. Si fallas, la bola se irá a un lado.",
    "qm.messUp": "¿Y si me lío con el golpe?",
    "qm.whereStart": "¿Por dónde empiezo?",
    "qm.gotIt": "Entendido",
    "qm.cancelPhone":
      "El botón X cancela el swing y te aparta de la bola del todo. Nada entra en tu tarjeta hasta que golpeas. Para recolocar la bola, ve a tu mochila.",
    "qm.cancelKey":
      "F cancela el swing y te aparta de la bola del todo. Nada entra en tu tarjeta hasta que golpeas. Para recolocar la bola, ve a tu mochila.",
    "qm.thanks": "Gracias",
    "qm.where":
      "El green de prácticas está aquí mismo, en la cabaña. Cuando te apetezca jugar en serio, apúntate en el tablón junto al primer tee y juega los nueve.",
    "qm.rightYouAre": "Muy bien",
    "qm.course":
      "{holes} hoyos, par {par}. Rampas, un barril que no se está quieto, un montacargas en el último que no espera a nadie, y un faro que ha arruinado a jugadores mejores que tú.",
    "qm.takeChances": "Me arriesgo",
    // ---- Coconutty ---------------------------------------------------------
    "coco.greet.drinkOne":
      "Ya llevas una dentro. Te queda {n} minuto, más o menos. Ve a disfrutarla. Quedarse quieto es desperdiciar una colada.",
    "coco.greet.drinkMany":
      "Ya llevas una dentro. Te quedan {n} minutos, más o menos. Ve a disfrutarla. Quedarse quieto es desperdiciar una colada.",
    "coco.greet.none":
      "¿Dónde están mis cocos, amigo? No parece que lleves ninguno. Esta isla está llena de palmeras y todas los sueltan más rápido de lo que yo puedo recogerlos, que es la única falta de mano de obra que he agradecido en mi vida.",
    "coco.greet.full":
      "{n} encima y ningún sitio donde meterlos. Ya he tenido mis {limit} de hoy. Más y se me pasan antes de llegar a ellos, y un coco pasado es un olor que no se olvida.",
    "coco.greet.one":
      "{n} coco. Hoy puedo aceptar {room} más. Del suelo, espero. Lo de los árboles lo decía en serio.",
    "coco.greet.many":
      "{n} cocos. Hoy puedo aceptar {room} más. Del suelo, espero. Lo de los árboles lo decía en serio.",
    "coco.handOver": "Darle {n}",
    "coco.forJug": "{n} para la jarra",
    "coco.colada": "Piña colada ({price} {pp})",
    "coco.whyCoconuts": "¿Por qué cocos?",
    "coco.howMany": "¿Cuántos te he traído?",
    "coco.cyaLater": "¡Hasta luego!",
    "coco.jug.waiting": "Se pone a separarlos y no levanta la vista.",
    "coco.jug.more":
      "Le da la vuelta a cada uno, lo golpea y lo deja en un montón aparte. \"{n} más y tengo jarra.\"",
    "coco.jug.done":
      "Rebusca entre ellos, levanta uno y se calla un momento. \"Ese es. Ese es la jarra.\"",
    "coco.whyACoconut": "¿Por qué un coco?",
    "coco.right": "Vale",
    "coco.handed":
      "Los coge de dos en dos, golpea uno contra otro y escucha. \"Ese está lleno\", dice. Sin aclarar cuál.",
    "coco.handedSilent":
      "Extiende las manos y las deja extendidas. No cambia nada de manos. (El servidor no ha contestado. Mira la consola por \"[golf] LEDGER SILENT\".)",
    "coco.whatDoYouDo": "¿Y qué haces con ellos?",
    "coco.poured.made":
      "Prepara la bebida en el propio coco y te la pasa sin pajita. \"Nada de pajitas\", dice. \"Las pajitas son lo único que el mar no devuelve nunca.\"",
    "coco.poured.pending": "Enciende la batidora. Al motor le cuesta un momento arrancar.",
    "coco.poured.tooPoor":
      "Te mira, mira la batidora y te vuelve a mirar. \"{price}\", dice. \"Ya te lo dije.\"",
    "coco.poured.silent":
      "Va a coger la jarra y se para. (No ha llegado nada del servidor. Mira la consola.)",
    "coco.whatIsInIt": "¿Qué lleva?",
    "coco.thanks": "Gracias",
    "coco.recipe":
      "Coco, evidentemente. Piña, y no te voy a decir de dónde la saco. Hielo, que es la parte que debería preocuparte, y ron, que es la parte que a mí no me preocupa nada. Verás que luego te mueves más rápido por la isla. Diviértete.",
    "coco.notHowItWorks": "Eso no funciona así",
    "coco.fairEnough": "Me vale",
    "coco.works":
      "No. No funciona así. Y sin embargo.\n\nMira, llevo once meses en esta isla, hay una mujer en una cueva que le habla al metal, y un hombre en la playa sur que le ha puesto nombre a algunas conchas. La bebida es lo de menos.",
    "coco.goodPoint": "Buen argumento",
    "coco.why":
      "Porque son gratis, están por todas partes, y son lo único aquí que es comida y vaso a la vez. Enséñame una concha que haga eso. Shellman no puede, y se lo he preguntado, largo y tendido, más de una vez.",
    "coco.whatBuilding": "¿Qué estás construyendo?",
    "coco.building.built":
      "Ya está. Cuchillas de un naufragio, una jarra de un coco y un motor de la cueva. Suena como una guerra y hace una bebida preciosa.",
    "coco.building.not":
      "Una batidora. Tres piezas y no tengo ninguna: algo con lo que picar, algo donde picar. ¿Me ayudas a conseguirlas, por favor?",
    "coco.tally.none": "Ninguno. No me has traído ninguno. Todavía no te lo tengo en cuenta.",
    "coco.tally.short": "{total}. Te faltan {left} para los cien, y en los cien está la bola.",
    "coco.tally.past":
      "{total}. Pasados los cien. Ahora me traes cocos por amor al arte, cosa que respeto.",
    "coco.whyHundred": "¿Por qué cien?"
  },
  de: {
    // ---- Salt, behind the counter at Putts 'n' Balls -----------------------
    "salt.greeting":
      "Hallo, ich heiße Salt, ich führe Putts ’n’ Balls seit Jahren. Minigolf auf einer Insel? Etwas seltsam... aber fragen wir lieber nicht. Du spielst mit einem {ball}, und auf deinen Namen laufen {pp} {ppShort}. Wenn du aufsteigst, komm vorbei, dann gibt es was Besseres.",
    "salt.showBalls": "Zeig mir die Bälle",
    "salt.showClubs": "Zeig mir die Schläger",
    "salt.wherePoints": "Woher kommen die Punkte?",
    "salt.justPassing": "Nur im Vorbeigehen",
    "salt.points":
      "Spiel die neun. Ankommen zahlt sich aus, und gut spielen zahlt sich besser aus: Pars, Birdies und ab und zu ein Hole-in-one. Die Punkte heißen {ppLong} und lassen sich für neue Ausrüstung ausgeben oder sonst wo im Pixel-Arcade-Ökosystem.",
    "salt.fairEnough": "Verstehe",
    // ---- Cave Explorer Sally -----------------------------------------------
    "sally.greet.noDetector":
      "Endlich, ein Lebenszeichen. Du bist seit Monaten der Erste in dieser Höhle. Ich brauche jemanden mit starkem Rücken und ohne starke Meinung zum Graben.",
    "sally.greet.none":
      "Nichts dabei. Der Boden hier ist voll davon, geh langsam und lass das Ding klicken. Alle laufen zu schnell und sagen mir dann, die Höhle sei leer.",
    "sally.greet.one": "{n} Stück dabei. Gib es her und ich schaue, was es werden will.",
    "sally.greet.many": "{n} Stücke dabei. Gib sie her und ich schaue, was sie werden wollen.",
    "sally.takeDetector": "Den Detektor nehmen",
    "sally.handOver": "{n} abgeben",
    "sally.whatDoing": "Was machst du hier draußen?",
    "sally.howWorks": "Wie funktioniert der Detektor?",
    "sally.letYouGetOn": "Ich lass dich mal weitermachen",
    "sally.given":
      "Häng ihn tief und lauf. Pass gut auf ihn auf, er ist der beste Metalldetektor, den ich je hatte. Er klickt bei Metall im Umkreis von etwa fünfzehn Metern. Je schneller das Ticken, desto näher das Gold, oder hier eben der Schrott. ",
    "sally.givenPhone":
      "Tippe auf den Putter-Knopf und grab. Tippe auf +, um ihn wegzupacken, wenn dir das Klicken auf die Nerven geht, und das wird es.",
    "sally.givenKey":
      "Drücke E und grab. Drücke 3, um ihn wegzupacken, wenn dir das Klicken auf die Nerven geht, und das wird es.",
    "sally.whatLooking": "Wonach suchst du?",
    "sally.right": "Alles klar",
    "sally.handed":
      "Das ist alles. {total}  Einiges ist Müll. Einiges nicht, und den Unterschied zu sehen ist das Einzige, was ich kann.",
    "sally.whatWorkedOut": "Was hast du herausgefunden?",
    "sally.backToIt": "Weiter geht’s",
    "sally.why":
      "Drei Dinge, der Reihe nach. Warum ein Schiff dieser Größe in so ruhigem Wasser untergeht, und wo es geblieben ist. Woher ein ganzer Neun-Loch-Platz auf einer Insel ohne Hafen kommt. Und wie man hier wieder wegkommt, denn in elf Monaten habe ich kein Boot gesehen, das nicht schon Wrack war.",
    "sally.anyAnswers": "Hast du Antworten?",
    "sally.grim": "Düster",
    "sally.answers.none":
      "Nicht eine. Das ist ja das Problem, und deshalb hältst du einen Detektor.",
    "sally.answers.early":
      "Ich arbeite an etwas Besonderem für dich. Das Metall in der Höhle wurde nicht von Felsen verbogen, so viel sage ich.",
    "sally.answers.some":
      "Genug, um zu wissen, dass Platz und Schiff aus demselben Metall sind, was mehr Fragen aufwirft als beantwortet.",
    "sally.answers.most":
      "Mehr als mir lieb ist. Frag mich bei einem ordentlichen Drink, dann erzähle ich es.",
    "sally.anythingIcanDo": "Kann ich was tun?",
    "sally.fairEnough": "Verstehe",
    "sally.howto":
      "Er reicht etwa {range} Meter, und graben kannst du ab {dig} Entfernung. Langsames Klicken heißt, da ist etwas; schnelles Klicken heißt, es liegt unter dir. Seltsam ist, dass sich eine Grabstelle nach einer Weile wieder füllt. Das Meer legt immer wieder etwas hin, keine Ahnung warum.",
    "sally.gotIt": "Kapiert",
    // ---- Shellman ----------------------------------------------------------
    "shellman.greet.none":
      "Hallo, Wanderer. Du scheinst keine Muscheln bei dir zu haben. Sie liegen im Sand. Ich bin viel zu wichtig, um selbst zu suchen, aber ich belohne dich, wenn du sie sammelst.",
    "shellman.greet.full":
      "Du hast {n}. Ich hatte heute meine {limit} und habe sie notiert. Komm morgen wieder.",
    "shellman.greet.one":
      "{n} Muschel. Heute nehme ich noch {room}. Und kümmere dich um deinen Kram.",
    "shellman.greet.many":
      "{n} Muscheln. Heute nehme ich noch {room}. Und kümmere dich um deinen Kram.",
    "shellman.handOver": "{n} abgeben",
    "shellman.whyShells": "Warum Muscheln?",
    "shellman.howMany": "Wie viele habe ich dir gegeben?",
    "shellman.leaveYou": "Ich lass dich mal",
    "shellman.handed":
      "Er nimmt sie, ohne hinzusehen, dreht jede einmal um und legt sie irgendwohin, wo du sie nicht siehst. \"Gezählt\", sagt er. \"Alle gezählt.\"",
    "shellman.handedSilent":
      "Er streckt die Hände aus und lässt sie ausgestreckt. Es geht nichts hin und her. (Der Server hat nicht geantwortet. Schau in der Konsole nach \"[golf] LEDGER SILENT\".)",
    "shellman.whatDoYouDo": "Was machst du damit?",
    "shellman.right": "Alles klar",
    "shellman.why":
      "Eine Muschel ist ein Haus, mit dem jemand fertig war. Jemand sehr Kleines, der keine Nachricht hinterlassen hat. Ich hebe sie auf, weil es unhöflich wirkt, dass es sonst niemand tut. Das ist der ganze Grund, und einen besseren hatte ich nie.",
    "shellman.doYouStop": "Hörst du nie auf?",
    "shellman.fairEnough": "Verstehe",
    "shellman.stop":
      "Ich nehme {limit} am Tag. Nicht weil ich {limit} will. Sondern weil ich sie ab {limit} nicht mehr sehe, und eine Muschel, die du nicht mehr siehst, kann genauso gut am Strand liegen bleiben.",
    "shellman.reasonable": "Das ist... vernünftig",
    "shellman.tally.none": "Keine. Nicht eine. Ich wüsste es.",
    "shellman.tally.short":
      "{total}. Hier sind {total}, weil ich {total} mal gezählt habe. Noch {left} bis zu den hundert.",
    "shellman.tally.past":
      "{total}. Über hundert. Wir waren uns einig, nicht über die hundert zu reden.",
    "shellman.whyHundred": "Warum hundert?",
    "shellman.thanks": "Danke",
    // ---- The Quartermaster -------------------------------------------------
    "qm.greet": "Willkommen in der Hütte. {stats} {field}",
    "qm.stats.practiceSome": "Du hast {n} auf dem Übungsgrün versenkt.",
    "qm.stats.notSignedOn": "Du hast dich noch nicht eingetragen.",
    "qm.stats.noHoles": "Du bist auf Loch {n} und hast noch keins gespielt.",
    "qm.stats.oneHole": "{holes} Loch gespielt, {total} Schläge, {par}.",
    "qm.stats.holes": "{holes} Löcher gespielt, {total} Schläge, {par}.",
    "qm.par.level": "auf Par",
    "qm.par.over": "{n} über",
    "qm.par.under": "{n} unter",
    "qm.field.none": "Im Moment ist niemand eingetragen. Der Platz gehört dir.",
    "qm.field.justYou": "Bisher nur du da draußen.",
    "qm.field.onePlayer": "Ein Spieler auf dem Platz.",
    "qm.field.many": "Gerade {n} auf dem Platz.",
    "qm.howDoIPlay": "Wie spiele ich?",
    "qm.whatsCourse": "Wie ist der Platz?",
    "qm.nothingForNow": "Nichts für jetzt",
    "qm.howtoPhone":
      "Geh zu deinem Ball und tippe auf den Putter-Knopf. Ziele, wohin der Ball soll, und bestätige. Wenn die Kraftanzeige läuft, bestätige die gewünschte Stärke mit einem zweiten Tippen. Versuche, die weiße Linie in der grünen Zone zu treffen. Verfehlst du sie, zieht der Ball nach links oder rechts.",
    "qm.howtoKey":
      "Geh zu deinem Ball und drücke E. Ziele, wohin der Ball soll, und bestätige. Wenn die Kraftanzeige läuft, bestätige die gewünschte Stärke mit einem zweiten Druck. Versuche, die weiße Linie in der grünen Zone zu treffen. Verfehlst du sie, zieht der Ball nach links oder rechts.",
    "qm.messUp": "Und wenn ich den Schlag verhaue?",
    "qm.whereStart": "Wo fange ich an?",
    "qm.gotIt": "Kapiert",
    "qm.cancelPhone":
      "Der X-Knopf bricht den Schwung ab und stellt dich ganz vom Ball weg. Auf deiner Karte steht nichts, bis der Ball geschlagen ist. Zum Neuplatzieren geh in deinen Rucksack.",
    "qm.cancelKey":
      "F bricht den Schwung ab und stellt dich ganz vom Ball weg. Auf deiner Karte steht nichts, bis der Ball geschlagen ist. Zum Neuplatzieren geh in deinen Rucksack.",
    "qm.thanks": "Danke",
    "qm.where":
      "Das Übungsgrün ist gleich hier in der Hütte. Wenn du richtig spielen willst, trag dich an der Tafel beim ersten Abschlag ein und spiel die neun.",
    "qm.rightYouAre": "Alles klar",
    "qm.course":
      "{holes} Löcher, Par {par}. Rampen, ein Fass, das nicht stillhält, ein Lift auf dem letzten, der auf niemanden wartet, und ein Leuchtturm, der schon bessere Spieler ruiniert hat als dich.",
    "qm.takeChances": "Ich riskiere es",
    // ---- Coconutty ---------------------------------------------------------
    "coco.greet.drinkOne":
      "Du hast schon eine intus. Noch etwa {n} Minute davon. Geh und genieß sie. Herumstehen ist Verschwendung einer Colada.",
    "coco.greet.drinkMany":
      "Du hast schon eine intus. Noch etwa {n} Minuten davon. Geh und genieß sie. Herumstehen ist Verschwendung einer Colada.",
    "coco.greet.none":
      "Wo sind meine schönen Kokosnüsse, Freund? Du scheinst keine dabeizuhaben. Diese Insel ist voller Palmen, und jede einzelne wirft sie schneller ab, als ich sie aufsammeln kann. Das ist der einzige Arbeitskräftemangel, über den ich je froh war.",
    "coco.greet.full":
      "{n} dabei und nirgendwo hin damit. Ich hatte heute meine {limit}. Mehr, und sie verderben, bevor ich rankomme, und eine verdorbene Kokosnuss ist ein Geruch, den man behält.",
    "coco.greet.one":
      "{n} Kokosnuss. Heute nehme ich noch {room}. Vom Boden, hoffe ich. Das mit den Bäumen war ernst gemeint.",
    "coco.greet.many":
      "{n} Kokosnüsse. Heute nehme ich noch {room}. Vom Boden, hoffe ich. Das mit den Bäumen war ernst gemeint.",
    "coco.handOver": "{n} abgeben",
    "coco.forJug": "{n} für den Krug",
    "coco.colada": "Pina Colada ({price} {pp})",
    "coco.whyCoconuts": "Warum Kokosnüsse?",
    "coco.howMany": "Wie viele habe ich dir gebracht?",
    "coco.cyaLater": "Bis später!",
    "coco.jug.waiting": "Er fängt an, sie zu sortieren, und schaut nicht auf.",
    "coco.jug.more":
      "Er dreht jede um, klopft daran und legt sie auf einen eigenen Haufen. \"Noch {n} und ich habe einen Krug.\"",
    "coco.jug.done":
      "Er wühlt sie durch, hält eine hoch und schweigt einen Moment. \"Das ist sie. Das ist ein Krug.\"",
    "coco.whyACoconut": "Warum eine Kokosnuss?",
    "coco.right": "Alles klar",
    "coco.handed":
      "Er nimmt sie zu zweit, schlägt eine gegen die andere und horcht. \"Die da ist voll\", sagt er. Ohne zu sagen, welche.",
    "coco.handedSilent":
      "Er streckt die Hände aus und lässt sie ausgestreckt. Nichts wechselt den Besitzer. (Der Server hat nicht geantwortet. Schau in der Konsole nach \"[golf] LEDGER SILENT\".)",
    "coco.whatDoYouDo": "Was machst du damit?",
    "coco.poured.made":
      "Er mixt den Drink in der Kokosnuss und reicht ihn ohne Halm herüber. \"Keine Halme\", sagt er. \"Halme sind das Einzige, was das Meer nie zurückgibt.\"",
    "coco.poured.pending": "Er schaltet den Mixer ein. Der Motor braucht einen Moment.",
    "coco.poured.tooPoor":
      "Er sieht dich an, dann den Mixer, dann wieder dich. \"{price}\", sagt er. \"Hab ich doch gesagt.\"",
    "coco.poured.silent":
      "Er greift nach dem Krug und hält inne. (Vom Server kam nichts zurück. Schau in die Konsole.)",
    "coco.whatIsInIt": "Was ist da drin?",
    "coco.thanks": "Danke",
    "coco.recipe":
      "Kokos, natürlich. Ananas, und woher ich die habe, sage ich dir nicht. Eis, und das ist der Teil, der dich beunruhigen sollte, und Rum, der Teil, der mich überhaupt nicht beunruhigt. Du wirst merken, dass du danach schneller herumkommst. Viel Spaß.",
    "coco.notHowItWorks": "So funktioniert das alles nicht",
    "coco.fairEnough": "Verstehe",
    "coco.works":
      "Nein. Tut es nicht. Und trotzdem.\n\nHör zu, ich bin seit elf Monaten auf dieser Insel, in einer Höhle sitzt eine Frau, die mit Metall redet, und am Südstrand ein Mann, der einigen Muscheln Namen gegeben hat. Der Drink ist das Harmloseste daran.",
    "coco.goodPoint": "Guter Punkt",
    "coco.why":
      "Weil sie umsonst sind, überall liegen, und das Einzige hier sind, das gleichzeitig Essen und Becher ist. Zeig mir eine Muschel, die das kann. Shellman kann es nicht, und ich habe ihn gefragt, ausführlich, mehr als einmal.",
    "coco.whatBuilding": "Was baust du da?",
    "coco.building.built":
      "Fertig gebaut. Klingen aus einem Wrack, ein Krug aus einer Kokosnuss und ein Motor aus der Höhle. Es klingt nach Krieg und macht einen wunderschönen Drink.",
    "coco.building.not":
      "Einen Mixer. Drei Teile, und ich habe keins davon: etwas zum Häckseln, etwas zum Hineinhäckseln. Hilfst du mir, sie zu besorgen?",
    "coco.tally.none": "Keine. Du hast mir keine gebracht. Ich rechne es dir noch nicht an.",
    "coco.tally.short":
      "{total}. Noch {left} bis zu den hundert, und bei den hundert liegt der Ball.",
    "coco.tally.past":
      "{total}. Über hundert. Jetzt bringst du mir Kokosnüsse aus reiner Liebe, und das respektiere ich.",
    "coco.whyHundred": "Warum hundert?"
  },
  fr: {
    // ---- Salt, behind the counter at Putts 'n' Balls -----------------------
    "salt.greeting":
      "Salut, moi c’est Salt, je tiens Putts ’n’ Balls depuis des années. Du mini-golf sur une île ? Un peu bizarre... mais ne posons pas de questions. Tu joues avec une {ball}, et tu as {pp} {ppShort} à ton nom. Quand tu monteras de niveau, passe me voir, j’aurai mieux.",
    "salt.showBalls": "Montre-moi les balles",
    "salt.showClubs": "Montre-moi les clubs",
    "salt.wherePoints": "D’où viennent les points ?",
    "salt.justPassing": "Je ne fais que passer",
    "salt.points":
      "Fais les neuf. Terminer rapporte, et bien jouer rapporte mieux : des pars, des birdies, et de temps en temps un trou en un. Les points s’appellent des {ppLong} et servent à améliorer ton matériel ou à dépenser ailleurs dans l’écosystème Pixel Arcade.",
    "salt.fairEnough": "Soit",
    // ---- Cave Explorer Sally -----------------------------------------------
    "sally.greet.noDetector":
      "Enfin, un signe de vie. Tu es la première personne à entrer dans la grotte depuis des mois. Il me faut quelqu’un avec un bon dos et aucune opinion tranchée sur le fait de creuser.",
    "sally.greet.none":
      "Rien sur toi. Le sol en est plein, balaie lentement et laisse le truc cliquer. Les gens marchent toujours trop vite et viennent me dire que la grotte est vide.",
    "sally.greet.one": "{n} morceau sur toi. Donne-le-moi et je verrai ce qu’il veut devenir.",
    "sally.greet.many":
      "{n} morceaux sur toi. Donne-les-moi et je verrai ce qu’ils veulent devenir.",
    "sally.takeDetector": "Prendre le détecteur",
    "sally.handOver": "Donner {n}",
    "sally.whatDoing": "Qu’est-ce que tu fais ici ?",
    "sally.howWorks": "Comment marche le détecteur ?",
    "sally.letYouGetOn": "Je te laisse continuer",
    "sally.given":
      "Porte-le bas et marche. Prends-en soin, c’est le meilleur détecteur de métaux que j’aie eu. Il clique quand il y a du métal à une quinzaine de mètres. Plus le tic est rapide, plus tu es près de l’or, ou ici, de la ferraille. ",
    "sally.givenPhone":
      "Touche le bouton du putter et creuse. Touche le bouton + pour le ranger quand le clic te tapera sur les nerfs, et ça viendra.",
    "sally.givenKey":
      "Appuie sur E et creuse. Appuie sur 3 pour le ranger quand le clic te tapera sur les nerfs, et ça viendra.",
    "sally.whatLooking": "Qu’est-ce que tu cherches ?",
    "sally.right": "D’accord",
    "sally.handed":
      "C’est tout. {total}  Une partie est bonne à jeter. Une autre non, et faire la différence est la seule chose que je sais faire.",
    "sally.whatWorkedOut": "Tu as trouvé quoi ?",
    "sally.backToIt": "Je m’y remets",
    "sally.why":
      "Trois choses, dans l’ordre. Pourquoi un navire de cette taille coule dans une eau si calme, et où il est passé. D’où sort un parcours de neuf trous sur une île sans port. Et comment on en repart, parce qu’en onze mois je n’ai pas vu un bateau qui ne soit pas déjà une épave.",
    "sally.anyAnswers": "Tu as des réponses ?",
    "sally.grim": "Charmant",
    "sally.answers.none":
      "Aucune. C’est bien le problème, et c’est pour ça que tu tiens un détecteur.",
    "sally.answers.early":
      "Je te prépare quelque chose de spécial. Le métal de la grotte n’a pas été tordu par des rochers, ça je peux le dire.",
    "sally.answers.some":
      "Assez pour savoir que le parcours et le navire sont du même métal, ce qui pose plus de questions que ça n’en règle.",
    "sally.answers.most": "Plus que je ne voudrais. Offre-moi un vrai verre et je te raconte.",
    "sally.anythingIcanDo": "Je peux faire quelque chose ?",
    "sally.fairEnough": "Soit",
    "sally.howto":
      "Il porte à environ {range} mètres et tu peux creuser dès que tu es à {dig} d’une chose. Des clics lents, il y a quelque chose ; des clics rapides, c’est sous toi. Le plus étrange, c’est qu’un trou se rebouche au bout d’un moment. La mer n’arrête pas de remettre des choses, va savoir.",
    "sally.gotIt": "Compris",
    // ---- Shellman ----------------------------------------------------------
    "shellman.greet.none":
      "Bonjour, voyageur. Tu ne sembles porter aucun coquillage. Ils sont sur le sable. Je suis bien trop important pour les chercher moi-même, mais je te récompenserai si tu les ramasses.",
    "shellman.greet.full":
      "Tu en as {n}. J’ai eu mes {limit} aujourd’hui et je les ai notés. Reviens demain.",
    "shellman.greet.one":
      "{n} coquillage. Je peux en prendre {room} de plus aujourd’hui. Et mêle-toi de tes affaires.",
    "shellman.greet.many":
      "{n} coquillages. Je peux en prendre {room} de plus aujourd’hui. Et mêle-toi de tes affaires.",
    "shellman.handOver": "Donner {n}",
    "shellman.whyShells": "Pourquoi des coquillages ?",
    "shellman.howMany": "Je t’en ai donné combien ?",
    "shellman.leaveYou": "Je te laisse",
    "shellman.handed":
      "Il les prend sans regarder, retourne chacune une fois, et la range là où tu ne vois pas. \"Comptés\", dit-il. \"Tous comptés.\"",
    "shellman.handedSilent":
      "Il tend les mains, et les laisse tendues. Rien ne passe entre vous. (Le serveur n’a pas répondu. Regarde la console pour \"[golf] LEDGER SILENT\".)",
    "shellman.whatDoYouDo": "Tu en fais quoi ?",
    "shellman.right": "D’accord",
    "shellman.why":
      "Un coquillage est une maison dont quelqu’un a fini. Quelqu’un de très petit, qui n’a pas laissé de mot. Je les garde parce que ça me semble impoli que personne ne le fasse. C’est toute la raison, et je n’en ai jamais eu de meilleure.",
    "shellman.doYouStop": "Tu t’arrêtes parfois ?",
    "shellman.fairEnough": "Soit",
    "shellman.stop":
      "J’en prends {limit} par jour. Pas parce que je veux {limit}. Parce qu’au-delà de {limit} je cesse de les voir, et un coquillage qu’on ne voit plus pourrait aussi bien être resté sur la plage.",
    "shellman.reasonable": "C’est... raisonnable",
    "shellman.tally.none": "Aucun. Pas un seul. Je m’en souviendrais.",
    "shellman.tally.short":
      "{total}. Voilà {total}, parce que je les ai comptés {total} fois. Il t’en manque {left} pour les cent.",
    "shellman.tally.past":
      "{total}. Au-delà des cent. Nous étions convenus de ne pas parler des cent.",
    "shellman.whyHundred": "Pourquoi cent ?",
    "shellman.thanks": "Merci",
    // ---- The Quartermaster -------------------------------------------------
    "qm.greet": "Bienvenue à la Cabane. {stats} {field}",
    "qm.stats.practiceSome": "Tu en as rentré {n} sur le green d’entraînement.",
    "qm.stats.notSignedOn": "Tu ne t’es pas encore inscrit.",
    "qm.stats.noHoles": "Tu es au trou {n} et tu n’en as pas encore rentré un.",
    "qm.stats.oneHole": "{holes} trou joué, {total} coups, {par}.",
    "qm.stats.holes": "{holes} trous joués, {total} coups, {par}.",
    "qm.par.level": "dans le par",
    "qm.par.over": "{n} au-dessus",
    "qm.par.under": "{n} en dessous",
    "qm.field.none": "Personne d’inscrit pour l’instant. Le parcours est à toi.",
    "qm.field.justYou": "Il n’y a que toi dehors pour l’instant.",
    "qm.field.onePlayer": "Un joueur sur le parcours.",
    "qm.field.many": "{n} sur le parcours en ce moment.",
    "qm.howDoIPlay": "On joue comment ?",
    "qm.whatsCourse": "Il est comment, le parcours ?",
    "qm.nothingForNow": "Rien pour l’instant",
    "qm.howtoPhone":
      "Va jusqu’à ta balle et touche le bouton du putter. Vise où tu veux l’envoyer et valide. Une fois la jauge de force lancée, valide la force voulue en touchant à nouveau. Essaie de toucher la ligne blanche dans la zone verte. Rate-la et la balle partira à gauche ou à droite.",
    "qm.howtoKey":
      "Va jusqu’à ta balle et appuie sur E. Vise où tu veux l’envoyer et valide. Une fois la jauge de force lancée, valide la force voulue en appuyant à nouveau. Essaie de toucher la ligne blanche dans la zone verte. Rate-la et la balle partira à gauche ou à droite.",
    "qm.messUp": "Et si je rate mon coup ?",
    "qm.whereStart": "Je commence où ?",
    "qm.gotIt": "Compris",
    "qm.cancelPhone":
      "Le bouton X annule ton swing et t’éloigne complètement de la balle. Rien n’est inscrit sur ta carte tant que la balle n’est pas frappée. Pour replacer ta balle, va dans ton sac.",
    "qm.cancelKey":
      "F annule ton swing et t’éloigne complètement de la balle. Rien n’est inscrit sur ta carte tant que la balle n’est pas frappée. Pour replacer ta balle, va dans ton sac.",
    "qm.thanks": "Merci",
    "qm.where":
      "Le green d’entraînement est juste ici, dans la cabane. Quand tu voudras jouer pour de vrai, inscris-toi au panneau près du premier départ et fais les neuf.",
    "qm.rightYouAre": "Très bien",
    "qm.course":
      "{holes} trous, par {par}. Des rampes, un tonneau qui ne tient pas en place, un monte-charge au dernier qui n’attend personne, et un phare qui a ruiné de meilleurs joueurs que toi.",
    "qm.takeChances": "Je tente ma chance",
    // ---- Coconutty ---------------------------------------------------------
    "coco.greet.drinkOne":
      "Tu en as déjà une dans le corps. Il t’en reste à peu près {n} minute. Va en profiter. Rester planté là, c’est gâcher une colada.",
    "coco.greet.drinkMany":
      "Tu en as déjà une dans le corps. Il t’en reste à peu près {n} minutes. Va en profiter. Rester planté là, c’est gâcher une colada.",
    "coco.greet.none":
      "Où sont mes belles noix de coco, l’ami ? Tu n’as pas l’air d’en avoir. Cette île est pleine de palmiers et chacun d’eux en lâche plus vite que je ne peux les ramasser, ce qui est la seule pénurie de main-d’œuvre dont je me sois jamais réjoui.",
    "coco.greet.full":
      "{n} sur toi et nulle part où les mettre. J’ai eu mes {limit} aujourd’hui. Davantage et elles tournent avant que j’y arrive, et une noix de coco tournée, c’est une odeur dont on se souvient.",
    "coco.greet.one":
      "{n} noix de coco. Je peux en prendre {room} de plus aujourd’hui. Ramassée au sol, j’espère. Je le pensais, pour les arbres.",
    "coco.greet.many":
      "{n} noix de coco. Je peux en prendre {room} de plus aujourd’hui. Ramassées au sol, j’espère. Je le pensais, pour les arbres.",
    "coco.handOver": "Donner {n}",
    "coco.forJug": "{n} pour le pichet",
    "coco.colada": "Pina colada ({price} {pp})",
    "coco.whyCoconuts": "Pourquoi des noix de coco ?",
    "coco.howMany": "Je t’en ai apporté combien ?",
    "coco.cyaLater": "À plus !",
    "coco.jug.waiting": "Il commence à les trier, et ne lève pas les yeux.",
    "coco.jug.more":
      "Il retourne chacune, la tapote, et la pose sur un tas à part. \"Encore {n} et j’ai un pichet.\"",
    "coco.jug.done":
      "Il fouille dedans, en lève une, et se tait un instant. \"C’est celle-là. Voilà un pichet.\"",
    "coco.whyACoconut": "Pourquoi une noix de coco ?",
    "coco.right": "D’accord",
    "coco.handed":
      "Il les prend deux par deux, cogne l’une contre l’autre, et écoute. \"Celle-là est pleine\", dit-il. Sans préciser laquelle.",
    "coco.handedSilent":
      "Il tend les mains et les laisse tendues. Rien ne change de mains. (Le serveur n’a pas répondu. Regarde la console pour \"[golf] LEDGER SILENT\".)",
    "coco.whatDoYouDo": "Tu en fais quoi ?",
    "coco.poured.made":
      "Il prépare la boisson dans la noix et te la tend sans paille. \"Pas de pailles\", dit-il. \"Les pailles sont la seule chose que la mer ne rend jamais.\"",
    "coco.poured.pending": "Il allume le mixeur. Le moteur met un moment à partir.",
    "coco.poured.tooPoor":
      "Il te regarde, puis le mixeur, puis toi. \"{price}\", dit-il. \"Je l’avais dit.\"",
    "coco.poured.silent":
      "Il tend la main vers le pichet et s’arrête. (Rien n’est revenu du serveur. Regarde la console.)",
    "coco.whatIsInIt": "Il y a quoi dedans ?",
    "coco.thanks": "Merci",
    "coco.recipe":
      "De la noix de coco, évidemment. De l’ananas, et je ne te dirai pas où je le trouve. De la glace, c’est la partie qui devrait t’inquiéter, et du rhum, c’est la partie qui ne m’inquiète pas du tout. Tu verras, tu te déplaces plus vite ensuite. Amuse-toi bien.",
    "coco.notHowItWorks": "Ça ne marche pas du tout comme ça",
    "coco.fairEnough": "Soit",
    "coco.works":
      "Non. Ça ne marche pas. Et pourtant.\n\nÉcoute, je suis sur cette île depuis onze mois, il y a une femme dans une grotte qui parle au métal, et un homme sur la plage sud qui a donné des noms à certains coquillages. La boisson, c’est le moins étrange.",
    "coco.goodPoint": "Pas faux",
    "coco.why":
      "Parce qu’elles sont gratuites, qu’il y en a partout, et que c’est la seule chose ici qui soit à la fois de la nourriture et un verre. Montre-moi un coquillage qui fait ça. Shellman en est incapable, et je le lui ai demandé, longuement, plus d’une fois.",
    "coco.whatBuilding": "Tu construis quoi ?",
    "coco.building.built":
      "Il est fini. Des lames tirées d’une épave, un pichet fait d’une noix de coco, et un moteur venu de la grotte. Ça fait un bruit de guerre et ça donne une boisson magnifique.",
    "coco.building.not":
      "Un mixeur. Trois pièces et je n’en ai aucune : de quoi hacher, de quoi hacher dedans. Tu peux m’aider à les trouver, s’il te plaît ?",
    "coco.tally.none": "Aucune. Tu ne m’en as apporté aucune. Je ne te le reproche pas encore.",
    "coco.tally.short":
      "{total}. Il t’en manque {left} pour les cent, et c’est aux cent qu’est la balle.",
    "coco.tally.past":
      "{total}. Au-delà des cent. Tu m’en apportes maintenant par pur amour de la chose, et ça, je respecte.",
    "coco.whyHundred": "Pourquoi cent ?"
  }
}
