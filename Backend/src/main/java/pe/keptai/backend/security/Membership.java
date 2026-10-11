package pe.keptai.backend.security;

import java.util.UUID;

/** Fila activa devuelta por {@code keptai_private.resolver_usuario}: usuario, organización y rol. */
public record Membership(UUID usuarioId, UUID organizacionId, AccessRole rol) {
}
