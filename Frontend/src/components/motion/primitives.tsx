import { motion, type HTMLMotionProps, type Transition, type Variants } from "motion/react";
import { Link } from "react-router";

// Primitivas de movimiento compartidas. Todo se declara a nivel de módulo para que
// ningún render cree objetos nuevos, y solo se animan transform y opacity (GPU).

/** Respuesta a la mano: hover y tap de botones, tarjetas y enlaces. */
export const spring: Transition = { type: "spring", stiffness: 420, damping: 30, mass: 0.7 };
/** Entradas de contenido: más suave, sin rebote visible. */
export const softSpring: Transition = { type: "spring", stiffness: 240, damping: 28, mass: 0.9 };

/** Contenedor que escalona la entrada de sus hijos con variantes. */
export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.015 } },
};

/** Cada bloque entra con opacidad y un leve desplazamiento en Y. */
export const itemVariants: Variants = {
  hidden: { opacity: 0.8 },
  show: { opacity: 1, transition: { duration: 0.16 } },
};

/** Menús, popovers y diálogos: aparecen desde su origen y salen igual. */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -6 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12 } },
};

export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 16 },
  show: { opacity: 1, scale: 1, y: 0, transition: softSpring },
  exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.15 } },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Feedback físico estándar para cualquier elemento pulsable. */
export const press = { whileTap: { scale: 0.99 }, transition: spring } as const;
/** Tarjetas clicables: elevación al pasar el cursor, hundimiento leve al pulsar. */
export const lift = { whileTap: { scale: 0.995 }, transition: spring } as const;

export function Stagger({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={listVariants} initial="hidden" animate="show" {...rest}>
      {children}
    </motion.div>
  );
}

/** Bloque que hereda la orquestación del Stagger más cercano. */
export function Item({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={itemVariants} {...rest}>
      {children}
    </motion.div>
  );
}

export const MotionLink = motion.create(Link);
