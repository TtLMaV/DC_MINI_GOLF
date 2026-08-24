/**
 * Deleted.
 *
 * This used to hold the locked address camera — a VirtualCamera that took over
 * the view while you were over the ball, with A and D turning the aim. It is
 * gone because it had to be: while a scene camera is driving, the camera
 * transform the scene can read is the *virtual* one, so there is no way to tell
 * where the player's mouse is pointing. Aiming with the mouse and locking the
 * camera are mutually exclusive, and the mouse won.
 *
 * The aim now comes from the player camera's own yaw, in game.ts.
 *
 * The file is left here only because this scene folder is synced rather than
 * rewritten, and an empty module is safer than a stale one. Safe to delete.
 */
export {}
