import { supabase } from './supabaseClient';

async function testUpdateAndDelete() {
  const invoiceId = "inv_pur_86418_1776329701265";
  
  console.log(`1. Changement de statut de la facture ${invoiceId} à 'Cancelled' ou 'Draft'...`);
  const { data: updateData, error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'Cancelled' })
    .eq('id', invoiceId)
    .select();
    
  if (updateError) {
    console.error("ERREUR lors de la mise à jour du statut :", updateError);
    return;
  }
  
  console.log("Statut mis à jour avec succès :", updateData);
  
  console.log("2. Tentative de suppression de la facture annulée...");
  const { data: deleteData, error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .select();
    
  if (deleteError) {
    console.error("ERREUR lors de la suppression de la facture annulée :", deleteError);
  } else {
    console.log("Suppression réussie ! Données :", deleteData);
  }
}

testUpdateAndDelete();
