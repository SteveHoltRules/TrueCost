/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(["N/record", "N/search", "N/query"], (record, search, query) => {
  /**
   * MHI | HC | Source Fields Inv & Opp| UE
   *
   * @param {Object} scriptContext
   * @param {Record} scriptContext.newRecord - New record
   * @param {string} scriptContext.type - Trigger type
   * @param {Form} scriptContext.form - Current form
   * @Since 2015.2
   */

  const getInputData = (soid) => {
    var sql = `
	  SELECT	
    NT.id, 	
    NT.trandate, 	
    BUILTIN.DF( NT.TYPE ) AS type, 	
    NT.TranID, 	
    REPLACE( BUILTIN.DF( NT.status), BUILTIN.DF( NT.Type) || ':') AS Status,	
    NTL.id AS linenumber,	
    NTL.custcol_hci_linkedwo AS woId,	
    NTL.itemtype,	
    NTL.isinventoryaffecting,	
    NTL.custcol4 AS iftracking,	
    NTL.inventorylocation,	
    NT.custbody_is_invoiced	
  FROM	
    NextTransactionLineLink AS NTLL 	
    INNER JOIN Transaction AS NT 	
      ON ( NT.ID = NTLL.NextDoc )	
    JOIN Transactionline AS NTL 	
      ON (NTL.transaction = NT.ID ) 	
  WHERE	
    NTL.custcol4 <> ' ' AND NTLL.PreviousDoc = ${soid} AND NT.recordtype = 'itemfulfillment' AND (NT.custbody_is_invoiced IS NULL OR NT.custbody_is_invoiced = 'F')`;

    var confirmInfo = query.runSuiteQL({ query: sql }).asMappedResults();
    // log.debug("Sales Order Input Data", soid);
    // log.debug("Sales Order Data", confirmInfo);
    return confirmInfo;
  };

  const getSoLineLink = (soid) => {
    log.debug("Inside getSoLineLink", soid);
    var sql = `
  SELECT
    Transaction.TranID,
    Transaction.ID,
    Transaction.trandate,
    TransactionLine.custcol_nco_so_linelink,
    TransactionLine.item
  FROM
  Transaction
  JOIN TransactionLine ON
  Transaction.id =TransactionLine.Transaction
  WHERE
        ( Transaction.id = ${soid}) AND TransactionLine.custcol_nco_so_linelink IS NOT NULL`;

    var confirmInfo = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("getSoLineLink SQL", sql);
    log.debug("getSoLineLink Info", confirmInfo);
    return confirmInfo;
  };

  const getonlyIFs = (soid) => {
    log.debug("Inside getonlyIFs", soid);
    var sql = `
  SELECT DISTINCT
    NT.TranID,
    NT.ID,
    NT.Foreigntotal AS abtotal,
    NT.trandate,
    NT.custbody_is_invoiced,
    NT.recordtype,
    NT.custbody_hci_vend_freightcost,
    NT.custbody_hf_outboundshipping,
    NT.custbody_hci_vend_freightcost,
    BUILTIN.DF(NT.custbody_hci_freightterms) AS FreightTerms,
    TL.custcol4
  FROM
    NextTransactionLineLink NTLL
    INNER JOIN Transaction NT ON
    (NT.ID = NTLL.NextDoc)
    JOIN TransactionLine TL ON
    (TL.transaction = NT.id)
  WHERE
    (NTLL.PreviousDoc = ${soid}) AND (NT.recordtype = 'itemfulfillment') AND (NT.custbody_is_invoiced IS NULL OR NT.custbody_is_invoiced = 'F')`;

    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("GET IF to Close", sql);
    log.debug("GET IF ConfirmInfo", mappedressults);
    return mappedressults;
  };

  const getIFdata = (soid, linelink) => {
    log.debug("Inside GetIFdata", soid + "-" + linelink);
    var sql = `
  SELECT DISTINCT
    NT.TranID,
    NT.ID,
    NT.Foreigntotal AS abtotal,
    NT.trandate,
    NT.custbody_is_invoiced,
    NT.recordtype,
    NT.custbody_hci_vend_freightcost,
    NT.custbody_hf_outboundshipping,
    NT.custbody_hci_vend_freightcost,
    BUILTIN.DF(NT.custbody_hci_freightterms) AS FreightTerms,
    TL.custcol4
  FROM
    NextTransactionLineLink NTLL
    INNER JOIN Transaction NT ON
    (NT.ID = NTLL.NextDoc)
    JOIN TransactionLine TL ON
    (TL.transaction = NT.id)
  WHERE
    (NTLL.PreviousDoc = ${soid}) AND (TL.custcol_nco_so_linelink = '${linelink}') AND (NT.recordtype = 'itemfulfillment') AND (NT.custbody_is_invoiced IS NULL OR NT.custbody_is_invoiced = 'F')`;

    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("GET IF SQL", sql);
    log.debug("GET IF ConfirmInfo", mappedressults);
    return mappedressults;
  };

  // sql to get the sequence number to use to pull the cogs
  const getIFglcostSeq = (ifid, linelink) => {
    log.debug(
      "Inside getIFglcostSeq",
      `ifid: ${ifid} and linelink: ${linelink}`
    );
    var sql = `
SELECT
	TransactionAccountingLine.transactionLine
FROM
	TransactionAccountingLine
	INNER JOIN TransactionLine ON
	( TransactionLine.Transaction = TransactionAccountingLine.Transaction 
	AND TransactionLine.ID = TransactionAccountingLine.TransactionLine )
WHERE
	( TransactionAccountingLine.Transaction = ${ifid})
	AND (TransactionLine.custcol_nco_so_linelink = '${linelink}')
ORDER BY
      TransactionLine.ID
`;

    log.debug({ title: "sql", details: sql });

    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("getIFglcostSeq", sql);
    log.debug("getIFglcostSeq ConfirmInfo", mappedressults);
    return mappedressults;
  };

  const getIFglcost = (ifid, item, lineid) => {
    log.debug(
      "Inside getIFglcost",
      `ifid: ${ifid} and item: ${item} and lineid: ${lineid}`
    );
    var sql = `
SELECT
	BUILTIN.DF( TransactionAccountingLine.Account ) AS Account,
	TransactionAccountingLine.Debit,
	TransactionAccountingLine.Credit,
	TransactionAccountingLine.Posting,
	TransactionLine.Memo,
	TransactionAccountingLine.transactionLine,
	TransactionLine.item,
	TransactionLine.Transaction,
  TransactionLine.uniquekey
FROM
	TransactionAccountingLine
	INNER JOIN TransactionLine ON
	( TransactionLine.Transaction = TransactionAccountingLine.Transaction 
	AND TransactionLine.ID = TransactionAccountingLine.TransactionLine )
WHERE
	( TransactionAccountingLine.Transaction = ${ifid})
	AND (TransactionLine.Item = ${item})
  AND (TransactionLine.linesequencenumber = ${lineid})
	AND ( TransactionAccountingLine.Debit IS NULL)
	AND ( Account IS NOT NULL)
ORDER BY
      TransactionLine.ID
`;

    log.debug({ title: "sql", details: sql });

    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("IF GL COST", ifid);
    log.debug("IF GL ConfirmInfo", mappedressults);
    return mappedressults;
  };

  const updateSalesTeam = (invRecord) => {
    var linecount = invRecord.getLineCount({ sublistId: "salesteam" });

    // log.debug("updateSalesTeam", "Beginning");
    // Populate salesteam from Commision Customer

    const gpAdj = invRecord.getValue("custbody_hci_gp_adjustment");
    // log.debug("GP Adjustment Checkbox", gpAdj);
    const gpAllowed = invRecord.getValue("custbody_hci_freightterms");
    // log.debug("Allowed", gpAllowed);
    try {
      //  if (gpAdj) {
      //    invRecord.setValue({
      //      fieldId: "custbody_hci_gpadjvend",
      //      value: 16538,
      //    });
      //    log.debug('Line After GP Adjustment Vendor Insert', "check")
      //  }
      for (var i = 0; i < linecount; i++) {
        var emp = invRecord.getSublistValue({
          sublistId: "salesteam",
          fieldId: "employee",
          line: i,
        });
        var salesrole = invRecord.getSublistValue({
          sublistId: "salesteam",
          fieldId: "salesrole",
          line: i,
        });
        var contribution = invRecord.getSublistValue({
          sublistId: "salesteam",
          fieldId: "contribution",
          line: i,
        });
        var isprimary = invRecord.getSublistValue({
          sublistId: "salesteam",
          fieldId: "isprimary",
          line: i,
        });

        log.debug("sales team ", emp + "-" + salesrole + "-" + contribution);
        if (isprimary == false && contribution > 0 && i == 1) {
          invRecord.setValue({
            fieldId: "custbody_alternaterep",
            value: emp,
          });
          log.debug(
            "sales team value set in custom field",
            emp + "-" + salesrole + "-" + contribution
          );
        }
        if (isprimary == false && contribution > 0 && i == 2) {
          invRecord.setValue({
            fieldId: "custbody_hf_alternate_rep_2",
            value: emp,
          });
          // log.debug(
          //   "sales team value set in custom field",
          //   emp + "-" + salesrole + "-" + contribution
          // );
        }
      }
    } catch (e) {
      log.error(e.name, e.message);
    }
    return;
  };

  const beforeLoad = (scriptContext) => {};

  /**
   * Function definition to be triggered before record is loaded.
   *
   * @param {Object} scriptContext
   * @param {Record} scriptContext.newRecord - New record
   * @param {Record} scriptContext.oldRecord - Old record
   * @param {string} scriptContext.type - Trigger type
   * @Since 2015.2
   */
  const beforeSubmit = (scriptContext) => {
    const currentRecord = scriptContext.newRecord;
    updateSalesTeam(currentRecord);
    /////////////////////////// this section is for the after submit functions on freight calculations //jzr 02/23/2023
     const getIFdata = (soid) => {
    
    var sql = `
    SELECT DISTINCT
	NT.TranID,
	NT.ID,
	NT.Foreigntotal AS abtotal,
	NT.trandate,
	NT.custbody_hf_work_order_status,
	NT.custbody_is_invoiced,
	NT.recordtype,
	NT.custbody_hci_vend_freightcost,
	NT.custbody_hf_outboundshipping,
	NT.custbody_hci_vend_freightcost,
	BUILTIN.DF(NT.custbody_hci_freightterms) AS FreightTerms,
	TL.custcol4
FROM
      NextTransactionLineLink NTLL
      INNER JOIN Transaction NT ON
        (NT.ID = NTLL.NextDoc)
      JOIN TransactionLine TL ON
		(TL.transaction = NT.id)
WHERE
      ( NTLL.PreviousDoc = ${soid}) AND (NT.recordtype = 'itemfulfillment') AND (TL.mainLine = 'T') AND (NT.custbody_is_invoiced IS NULL OR NT.custbody_is_invoiced = 'F')`;

    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    return mappedressults;
  };
    ////////////// put condition here for IF record ///////////////
    
     const freight = (soid) => {
    log.debug("Inside Freight", "--Start--");
    let sumOfFreightCost = 0;
    let sumOfOutboundShipping = 0;
    let sumOfInboundShipping = 0;
    const freightcost = {
      totalfreight: 0,
      totaloutboundfreight: 0,
      totalinboundfreight: 0,
    };
    const itemfulfill = getIFdata(soid);
    log.debug(itemfulfill);
    const ifLength = itemfulfill.length;
  
    for (i = 0; i < ifLength; i++) {
      // need to mimic the results so that the costobject contains results
      log.debug("Inside for loop of freight");
      let freightCostonIF = 0;
      let outboundshippingIF = 0;
      // Can I return the item fulfillment record values as an array and then put that in a custom column on the INV?
      itemfulfillmentId = itemfulfill[i].id;
      itemfulfillmentRec = record.load({
        type: record.Type.ITEM_FULFILLMENT,
        id: itemfulfillmentId,
      });

      freightCostonIF = itemfulfill[i].custbody_hci_vend_freightcost || 0;
      outboundshippingIF = itemfulfill[i].custbody_hf_outboundshipping || 0;
      inboundShippingIF = itemfulfillmentRec.getValue("handlingcost") || 0;
      sumOfFreightCost += freightCostonIF;
      log.debug("sumOfFreightCost =", sumOfFreightCost);
      sumOfOutboundShipping += outboundshippingIF;
      log.debug("sumOfOutboundShipping =", sumOfOutboundShipping);
      sumOfInboundShipping += inboundShippingIF;
      log.debug("sumOfInboundShipping =", sumOfInboundShipping);
    }
    freightcost.totalfreight = sumOfFreightCost;
    freightcost.totaloutboundfreight = sumOfOutboundShipping;
    freightcost.totalinboundfreight = sumOfInboundShipping;
    log.debug("Freight Cost", freightcost);
    return freightcost;
  };
    log.debug('custom form',currentRecord.customform);
    if(currentRecord.getValue("customform") != 266){
     if (
        scriptContext.type === scriptContext.UserEventType.CREATE //|| jzr 03/23/2023 this was causing issues with clearing freight
        //scriptContext.type === scriptContext.UserEventType.EDIT
      ) {
        const currentRecord = scriptContext.newRecord;
        const type = record.type;
        log.debug("Type", type);
        const createdFromId = currentRecord.getValue("createdfrom");
        log.debug("Get Created From", createdFromId);
      // const freightTerms = currentRecord.getText("custbody_hci_freightterms");
        
        const freightTerms = currentRecord.getValue("custbody_hci_freightterms");
        // getValue to pull the internal ID from freight terms and set it. 
        const noInbound = currentRecord.getValue(
          "custbody_hf_do_not_bill_inbound"
        );
        log.debug("Freight terms selected", freightTerms);
        if (createdFromId != "") {
          log.debug("Inside Created From", "Created From IF");
          // include only the cost that has not been invoiced yet.
          const costObject = freight(createdFromId);
          log.debug("costObject", costObject);
          if (freightTerms == 1 || freightTerms == 4) {
            log.debug(
              "Inside Prepaid and Add Or Third Party Billing ",
              freightTerms
            );
            //vendor freight cost + adder
            currentRecord.setValue({
              fieldId: "shippingcost",
              value: parseFloat(costObject.totaloutboundfreight),
            });
            //set the summary level by using altshippingcost
            currentRecord.setValue({
              fieldId: "altshippingcost",
              value: parseFloat(costObject.totaloutboundfreight),
            });
            // setting the field as outboundshipping
            currentRecord.setValue({
              fieldId: "custbody_hf_outboundshipping",
              value: parseFloat(costObject.totaloutboundfreight),
            
            });
            //handling cost (Inbound Freight)
            currentRecord.setValue({
              fieldId: "handlingcost",
              value: parseFloat(costObject.totalinboundfreight),
            });
            currentRecord.setValue({
              fieldId: "custbody_hci_vend_freightcost",
              value: parseFloat(costObject.totalfreight),
            });
            log.debug(
              "Freight updated SO =" +
                createdFromId +
                " Total Freight cost from IF = " +
                costObject.totaloutboundfreight
            );

          } else {
            //All other Freight Terms
            log.debug("Other Freight Terms ", freightTerms);
            //set shipping cost to zero
            currentRecord.setValue({
              fieldId: "shippingcost",
              value: 0,
            });
            //set the summary level by using altshippingcost
            currentRecord.setValue({
              fieldId: "altshippingcost",
              value: 0,
            });
            //set handling cost to zero
            currentRecord.setValue({
              fieldId: "handlingcost",
              value: 0,
            });
            currentRecord.setValue({
              fieldId: "althandlingcost",
              value: 0,
            });
            currentRecord.setValue({
              fieldId: "custbody_hf_outboundshipping",
              value: parseFloat(costObject.totaloutboundfreight),
            });
            //Vendor Freight Cost
            currentRecord.setValue({
              fieldId: "custbody_hci_vend_freightcost",
              value: parseFloat(costObject.totalfreight),
            });
            log.debug(
              "Freight updated SO =" +
                createdFromId +
                " Total Freight cost from IF = " +
                costObject.totaloutboundfreight
            );

          }
        }
      }
    }
    /////////////////////////////////////////
    const type = scriptContext.type;
    log.debug("type", type);
    const soid = currentRecord.getValue({
      fieldId: "createdfrom",
    });
    log.debug("Current Record", currentRecord);
    log.debug("SOiD", soid);
    const invLines = currentRecord.getLineCount("item");
    log.debug("Invoice Lines", invLines);

    try {
      for (j = 0; j < invLines; j++) {
        // this should be changed to only include certain if record
        const soInfo = getInputData(soid);
        const tracking = soInfo[j].iftracking;

        // log.debug("tracking", tracking);
        const setTracking = currentRecord.setSublistValue({
          sublistId: "item",
          fieldId: "custcol4",
          line: j,
          value: tracking,
        });

        log.debug("Set Tracking", setTracking);
        // ab invoice = null then grab the assembly build total and place the value into the invoice line
        // log.debug("Current Record before WO", currentRecord);
      }

      if (scriptContext.type === scriptContext.UserEventType.CREATE) {
        

        const allLineLinks = getSoLineLink(soid);
        log.debug({ title: "length", details: allLineLinks.length });
        log.debug({ title: "All Line Links", details: allLineLinks });
        log.debug("Are there multiple SOLineLinks with this same Item?");
        const arrayOfItems = [];
        for (s = 0; s < allLineLinks.length; s++) {
          arrayOfItems.push(allLineLinks[s].item);
        }
        // how will I know that an array has multiple items?
        const mapofItems = arrayOfItems.reduce(function (prev, cur) {
          prev[cur] = (prev[cur] || 0) + 1;
          return prev;
        }, {});
        log.debug("Map of Items", mapofItems);
        if (!allLineLinks.length) return;
        // multiple IF records & multiple lines on the IF record
        for (m = 0; m < allLineLinks.length; m++) {
          let soLineLink = allLineLinks[m].custcol_nco_so_linelink;
          log.debug("SoLineLink", soLineLink);
          let soItem = allLineLinks[m].item;
          log.debug("SOItem", soItem);
          // find the name in the object
          // pull the value from the object
          // use that value as the iterator for GL cost - if there are two identical items, find the solinelink with the matches, label the first, label the second and only assign cost to the matching label
          // get all of the if records with the same solinelink number
          const ifIds = getIFdata(soid, soLineLink);
          let projectedtotal = 0;
          for (n = 0; n < ifIds.length; n++) {
            // projected total is per linelink and also for all line links on other if records
            const ifnumber = ifIds[n].id;
            log.debug("IF ID", ifnumber);
            let lineIdseq = getIFglcostSeq(ifIds[n].id, soLineLink);
            let lineid = Number(lineIdseq[0].transactionline) + 2;
            let ifGLcost = getIFglcost(ifIds[n].id, soItem, lineid);
            // for the item, how will I know if it is the first or second?
            // count the returns of the SOlinelink with the same item and compare to the getIFglCost return. Designate one and compare to the other
            // the gl impact for the cost will not be split over two lines for the same solinelink. Therefore it can always use the first returned glcost.
            // if the glcost has two lines, it should only match the iterated line - that matches the sequence of solinelink
            log.debug("GL Credit", ifGLcost[0].credit);
            projectedtotal += ifGLcost[0].credit;
            log.debug({
              title: "projected total line",
              details: projectedtotal,
            });
          }
          log.debug({
            title: "projected total increment",
            details: projectedtotal,
          });
          var solinelinkmatchline = currentRecord.findSublistLineWithValue({
            sublistId: "item",
            fieldId: "custcol_nco_so_linelink",
            value: projectedtotal,
          });
          // returns the line location
          log.debug({
            title: "solinelinkmatchline",
            details: solinelinkmatchline,
          });

          if (solinelinkmatchline !== -1) {
            log.debug({ title: "", details: "hereToSet" });
            // switch this to populate the cost estimate
            const setTotal = currentRecord.setSublistValue({
              sublistId: "item",
              fieldId: "costestimate",
              line: solinelinkmatchline,
              value: projectedtotal,
            });
          }
          log.debug("Projected Total", projectedtotal);
          log.debug({ title: "matchLine", details: soLineLink });
        }
      }
    } catch (e) {
      log.error(e.name, e.message);
    }
  };

  const afterSubmit = (scriptContext) => {
    const currentRecord = scriptContext.newRecord;
    log.debug("Current Record", currentRecord);

    const contextType = scriptContext.type;
    log.debug("type", contextType);
    // if (contextType != "create") return;

    log.debug("type", contextType);
    const soid = currentRecord.getValue({
      fieldId: "createdfrom",
    });

    if (scriptContext.type === scriptContext.UserEventType.CREATE) {
      log.debug("SOiD", soid);

      const itemfulfill = getonlyIFs(soid);
      log.debug("After Submit: Item Fulfillment", itemfulfill);
      const itemfullength = itemfulfill.length;
      log.debug("After Submit: Item Fulfillment", itemfullength);
      for (j = 0; j < itemfullength; j++) {
        const ifId = itemfulfill[j].id;
        const ifRecord = record.load({
          type: record.Type.ITEM_FULFILLMENT,
          id: ifId,
        });

        ifRecord.setValue({
          fieldId: "custbody_is_invoiced",
          value: true,
        });

        // save the Work Order
        const ifRecSaved = ifRecord.save({
          enableSourcing: true,
          ignoreMandatoryFields: true,
        });
      }
    }
  };

  return {
    //beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit,
  };
});
