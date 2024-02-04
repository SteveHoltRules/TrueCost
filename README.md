# TrueCost

Two branches the pochanges include the current production values and the main includes the backedup branch called develop_fixpo. The code has to be refactored to include the changes that Jospeh included as well as the changes to check for purchase orders.

This script is executed on the invoice and pulls the cost based on the unique line identifier to pull in the cost acros the item fulfillments and vendor bills, for dropship items, and places the received cost on the invoice to track the expected profit on an invoice by invoice basis.
In addition to the true cost, this script also includes a function to get the salesman split percentage based on the customer, as well as a script to pull the freight cost into the invoice. The freight cost is based on the ship item and is a separate customization, but included here because there was a racing condition between the two scripts that caused errors and the cost to be wiped on existing orders.
