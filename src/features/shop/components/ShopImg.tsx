interface Props {
  image: string
  alt?: string
  className?: string
}

/** Rasm path bo'lsa <img>, aks holda (emoji fallback) text. */
export function ShopImg({ image, alt = '', className }: Props) {
  if (image.startsWith('/')) {
    return <img src={image} alt={alt} loading="lazy" draggable={false} className={className} />
  }
  return <span className={className}>{image}</span>
}
