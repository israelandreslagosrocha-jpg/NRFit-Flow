/** Redes verificadas en el canal oficial y confirmadas por su propietario. */
export const PUBLIC_SOCIAL = {
  youtube: 'https://www.youtube.com/@NRFitandFlow',
  subscribe: 'https://www.youtube.com/@NRFitandFlow?sub_confirmation=1',
  instagram: 'https://www.instagram.com/nr.fitandflow/',
};

/** Selección editorial pública; nunca leer la biblioteca privada de alumnas aquí. */
export const FREE_WORKOUTS = [
  {
    id: 'BvZ08hjIF4o',
    playback: 'embedded',
    title: 'Pilates para principiantes',
    category: 'PILATES',
    description: 'Una clase con trabajo de fuerza, planchas y banda elástica para conocer cómo entrena Natalia.',
    thumbnail: '/images/free-workouts/pilates-principiantes.avif',
  },
  {
    id: 'jjcmvwv1hP8',
    playback: 'youtube',
    title: 'Clase de GAP',
    category: 'GLÚTEOS · ABDOMEN · PIERNAS',
    description: 'Prueba una clase de GAP desde casa y descubre si esta forma de entrenar se adapta a ti.',
    thumbnail: '/images/free-workouts/clase-gap.avif',
  },
] as const;

export function freeWorkoutEmbed(id: string) {
  if (!FREE_WORKOUTS.some((video) => video.id === id && video.playback === 'embedded')) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
}
