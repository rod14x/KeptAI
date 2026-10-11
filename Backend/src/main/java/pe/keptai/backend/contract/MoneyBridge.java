package pe.keptai.backend.contract;
import java.math.BigDecimal;
import java.math.RoundingMode;
/** Conversion exacta del contrato, no motor financiero. No float/double ni redondeo silencioso. */
public final class MoneyBridge {
 private MoneyBridge(){}
 public static long solesToCents(BigDecimal soles){
  if(soles==null || soles.signum()<0) throw new IllegalArgumentException("Importe ausente o negativo");
  long cents=soles.setScale(2,RoundingMode.UNNECESSARY).movePointRight(2).longValueExact();
  if(cents>CommonDtos.MAX_SAFE_CENTS) throw new IllegalArgumentException("Fuera de rango seguro");
  return cents;
 }
 public static BigDecimal centsToSoles(long cents){
  if(cents>CommonDtos.MAX_SAFE_CENTS || cents< -CommonDtos.MAX_SAFE_CENTS) throw new IllegalArgumentException("Fuera de rango seguro");
  return BigDecimal.valueOf(cents,2);
 }
}
