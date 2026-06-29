import { Wine, StockMovement } from '../../types';
import { getBottleEquivalent } from '../../utils';

/**
 * Service dédié au calcul du Coût Unitaire Moyen Pondéré (CUMP)
 * et à la gestion des mouvements de stock.
 */

export const calculateNewCump = (
  currentWine: Wine,
  newMovement: StockMovement
): { stock: number; buyingPriceHT: number } => {
  const currentStock = currentWine.stock || 0;
  const currentCump = currentWine.buyingPriceHT || 0;

  if (newMovement.impactStock === false) {
    return { stock: currentStock, buyingPriceHT: currentCump };
  }

  let nextStock = currentStock;
  let nextCump = currentCump;

  const qty = newMovement.quantity;
  const price = newMovement.price !== undefined ? newMovement.price : currentCump;
  const shipping = newMovement.shippingCost || 0;

  if (newMovement.type === 'IN') {
    nextStock = currentStock + qty;
    const totalValue = (currentStock * currentCump) + (qty * price) + shipping;
    nextCump = nextStock > 0 ? totalValue / nextStock : price;
  } else if (newMovement.type === 'OUT' || newMovement.type === 'TRANSFER') {
    nextStock = currentStock - qty;
    // CUMP remains same on OUT/TRANSFER
  } else if (newMovement.type === 'ADJUST') {
    nextStock = currentStock + qty;
    // CUMP remains same on ADJUST unless price is specified
    if (newMovement.price !== undefined) {
      const totalValue = (currentStock * currentCump) + (qty * price);
      nextCump = nextStock > 0 ? totalValue / nextStock : currentCump;
    }
  }

  return {
    stock: nextStock,
    buyingPriceHT: parseFloat(nextCump.toFixed(4))
  };
};

/**
 * Recalcule totalement le stock et le PMP à partir de l'historique complet.
 * À utiliser uniquement lors de modifications manuelles de l'historique (corrections).
 */
export const recalculateFromHistory = (
  initialWine: Wine,
  history: StockMovement[]
): { stock: number; buyingPriceHT: number } => {
  // On repart d'un état "0" pour le vin s'il s'agit d'une reconstruction totale
  // Mais ici on veut peut-être préserver l'état initial avant les mouvements ?
  // En général, dans cette app, l'historique contient tout depuis la création.
  
  let currentStock = 0;
  let currentCump = 0;

  // Trier par date pour être sûr
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const move of sorted) {
    if (move.impactStock === false) continue;

    const qty = move.quantity;
    const price = move.price !== undefined ? move.price : currentCump;
    const shipping = move.shippingCost || 0;

    if (move.type === 'IN') {
      const totalValue = (currentStock * currentCump) + (qty * price) + shipping;
      currentStock += qty;
      currentCump = currentStock > 0 ? totalValue / currentStock : price;
    } else if (move.type === 'OUT' || move.type === 'TRANSFER') {
      currentStock -= qty;
      // CUMP reste identique
    } else if (move.type === 'ADJUST') {
      const totalValue = (currentStock * currentCump) + (qty * (move.price !== undefined ? move.price : currentCump));
      currentStock += qty;
      if (move.price !== undefined) {
        currentCump = currentStock > 0 ? totalValue / currentStock : currentCump;
      }
    }
  }

  return {
    stock: currentStock,
    buyingPriceHT: parseFloat(currentCump.toFixed(4))
  };
};
