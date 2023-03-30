/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(["N/record", "N/search", "N/query"], (record, search, query) => {
  // MHI | HC | Source Fields Inv & Opp| UE
  /**
   * Function definition to be triggered before record is loaded.
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
    NTL.inventorylocation
  FROM
    NextTransactionLineLink AS NTLL 
    INNER JOIN Transaction AS NT 
      ON ( NT.ID = NTLL.NextDoc )
    JOIN Transactionline AS NTL 
      ON (NTL.transaction = NT.ID ) 
  WHERE
    NTL.custcol4 <> ' ' AND (NTLL.PreviousDoc) = ${soid}`;

    var confirmInfo = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("Sales Order Input Data", soid);
    log.debug("Sales Order Data", confirmInfo);
    return confirmInfo;
  };

  const getIFdata = (soid) => {
    log.debug("Inside GetIFdata", soid);
    var sql = `
  SELECT
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
        ( NTLL.PreviousDoc = ${soid}) AND (NT.recordtype = 'itemfulfillment') AND (TL.mainLine = 'T') AND (NT.custbody_is_invoiced IS NULL OR NT.custbody_is_invoiced = 'F')`;

    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("GET IF Values", soid);
    log.debug("GET IF ConfirmInfo", mappedressults);
    return mappedressults;
  };

  const getSOlinelink = (ifid) => {
    log.debug({ title: "Inside getSOlinelink", details: ifid });
    var sql = `SELECT
	TransactionLine.custcol_nco_so_linelink AS linelink
    FROM
      TransactionAccountingLine
      INNER JOIN TransactionLine ON
        ( TransactionLine.Transaction = TransactionAccountingLine.Transaction )
        AND ( TransactionLine.ID = TransactionAccountingLine.TransactionLine )
    WHERE
      ( TransactionAccountingLine.Transaction = ${ifid} ) AND
	TransactionLine.custcol_nco_so_linelink IS NOT NULL
    ORDER BY
      TransactionLine.ID`;
    log.debug("GET IF SOLineLInk", sql);
    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    // log.debug("GET IF Item of", sql);
    log.debug("GET IF SOLineLink", mappedressults);
    return mappedressults;
  };

  const getIFitem = (ifid, solinkid) => {
    log.debug({ title: "Inside IF Item SO LINK ID", details: solinkid });
    var sql = `SELECT
	TransactionLine.item
    FROM
      TransactionAccountingLine
      INNER JOIN TransactionLine ON
        ( TransactionLine.Transaction = TransactionAccountingLine.Transaction )
        AND ( TransactionLine.ID = TransactionAccountingLine.TransactionLine )
    WHERE
      ( TransactionAccountingLine.Transaction = ${ifid} )
AND (TransactionLine.custcol_nco_so_linelink = '${solinkid}')
    ORDER BY
      TransactionLine.ID`;
    log.debug("GET IF Item SQL", sql);
    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    // log.debug("GET IF Item of", sql);
    log.debug("GET IF Item ID", mappedressults);
    return mappedressults;
  };

  const getIFglcost = (ifid, lineitem) => {
    log.debug("Inside ifglcost", ifid);
    var sql = `
SELECT
	BUILTIN.DF( TransactionAccountingLine.Account ) AS Account,
	TransactionAccountingLine.Debit,
	TransactionAccountingLine.Credit,
	TransactionAccountingLine.Posting,
	TransactionLine.Memo,
	TransactionAccountingLine.transactionLine,
	TransactionLine.item
FROM
	TransactionAccountingLine
	INNER JOIN TransactionLine ON
	( TransactionLine.Transaction = TransactionAccountingLine.Transaction )
	AND ( TransactionLine.ID = TransactionAccountingLine.TransactionLine )
WHERE
	( TransactionAccountingLine.Transaction = ${ifid} )
	AND (TransactionLine.Item = ${lineitem})
	AND ( TransactionAccountingLine.Debit IS NULL)
	AND ( Account IS NOT NULL)
ORDER BY
      TransactionLine.ID`;

    log.debug({ title: "sql", details: sql });

    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    log.debug("IF GL COST", ifid);
    log.debug("IF GL ConfirmInfo", mappedressults);
    return mappedressults;
  };

  const getPOInfo = (soid) => {
    log.debug({ title: "Inside getVPOInfo", details: soid });
    var sql = `SELECT
	Transactionline.item,
	Transactionline.createdpo, 
	Transactionline.custcol_nco_so_linelink,
	Transactionline.dropship,
FROM
	Transactionline
WHERE 
	-- Sales Order as Transaction ID
      Transactionline.transaction = ${soid} AND Transactionline.createdpo IS NOT NULL AND Transactionline.dropship = 'T'`;
    log.debug("GET PO SOLineLInk", sql);
    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    // log.debug("GET IF Item of", sql);
    log.debug("GET PO SOLineLink", mappedressults);
    return mappedressults;
  };

  const getVBInfo = (poid, linelink) => {
    log.debug({ title: "Inside getVBInfo", details: poid });
    var sql = `SELECT
	TransactionLine.item,
	BUILTIN.DF(TransactionLine.item) AS ItemName,
	NextTransactionLineLink.nexttype,
	NextTransactionLineLink.nextdoc,
	TransactionLine.itemtype,
	TransactionLine.custcol_nco_so_linelink,
	Transaction.custbody_is_invoiced
FROM
	 NextTransactionLineLink
	INNER JOIN Transaction ON
	( Transaction.ID = NextTransactionLineLink.NextDoc )
	JOIN TransactionLine ON
	Transaction.id = TransactionLine.transaction
WHERE
	-- PO as Transaction ID
	NextTransactionLineLink.PreviousDoc = ${poid} AND NextTransactionLineLink.nexttype = 'VendBill' AND TransactionLine.custcol_nco_so_linelink = '${linelink}' AND (Transaction.custbody_is_invoiced IS NULL OR Transaction.custbody_is_invoiced = 'F')`;
    log.debug("GET VB SOLineLInk", sql);
    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    // log.debug("GET IF Item of", sql);
    log.debug("GET VB SOLineLink", mappedressults);
    return mappedressults;
  };

  // the GL cost function pulls the debit instead of the credit
  const getVBglcost = (vbid, item) => {
    log.debug({ title: "Inside getVBglCost", details: vbid });
    var sql = `SELECT
	BUILTIN.DF( TransactionAccountingLine.Account ) AS Account,
	TransactionAccountingLine.Debit,
	TransactionAccountingLine.Credit,
	TransactionAccountingLine.Posting,
	TransactionLine.Memo,
	TransactionAccountingLine.transactionLine,
	TransactionLine.item
FROM
	TransactionAccountingLine
	INNER JOIN TransactionLine ON
	( TransactionLine.Transaction = TransactionAccountingLine.Transaction )
	AND ( TransactionLine.ID = TransactionAccountingLine.TransactionLine )
WHERE
	( TransactionAccountingLine.Transaction = ${vbid} )
	AND (TransactionLine.Item = ${item} )
	AND ( TransactionAccountingLine.Credit IS NULL)
	AND ( Account IS NOT NULL)
ORDER BY
      TransactionLine.ID'`;
    log.debug("GET VB SOLineLInk", sql);
    var mappedressults = query.runSuiteQL({ query: sql }).asMappedResults();
    // log.debug("GET IF Item of", sql);
    log.debug("GET VB SOLineLink", mappedressults);
    return mappedressults;
  };

  const updateSalesTeam = (invRecord) => {
    var linecount = invRecord.getLineCount({ sublistId: "salesteam" });

    // log.debug("updateSalesTeam", "Beginning");
    // Populate salesteam from Commision Customer

    const gpAdj = invRecord.getValue("custbody_hci_gp_adjustment");
    log.debug("GP Adjustment Checkbox", gpAdj);
    const gpAllowed = invRecord.getValue("custbody_hci_freightterms");
    log.debug("Allowed", gpAllowed);
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
          log.debug(
            "sales team value set in custom field",
            emp + "-" + salesrole + "-" + contribution
          );
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
        const soInfo = getInputData(soid);
        const tracking = soInfo[j].iftracking;

        log.debug("tracking", tracking);
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

      const ifId = getIFdata(soid);
      const poId = getPOInfo(soid);
      if (ifId.length) {
        // multiple IF records & multiple lines on the IF record
        // need to change how we think about this -
        for (m = 0; m < ifId.length; m++) {
          const ifnumber = ifId[m].id;
          log.debug("IF ID", ifnumber);
          const solineLinkArray = getSOlinelink(ifnumber);
          log.debug("solinelinkArray", solineLinkArray);
          // find the line link number of the first item fulfillment line
          // function to get the item id
          const solineItem = getIFitem(ifnumber, solineLinkArray[m].linelink);
          log.debug("Item", solineItem);
          log.debug(
            "Trying to see item array return value",
            solineItem[0].item
          );
          // ifInfo is returning the same solinelink for different lines...why? The accounting lines are not tied to the item lines
          const ifInfo = getIFglcost(ifnumber, solineItem[0].item);
          log.debug("Item Fulfillment Info", ifInfo);
          const ifIdLines = ifInfo.length;
          log.debug("IF Info Length", ifIdLines);
          // how do I get this to cycle through its own loop
          let projectedtotal = 0;
          // need a way to loop through the lines from the IF record to place onto the invoice
          for (n = 0; n < ifIdLines; n++) {
            if (ifInfo[n].posting == "T") {
              // projected total accounts for additional IF lines of the same SO line
              projectedtotal += ifInfo[n].credit;
              log.debug("Projected Total", projectedtotal);
              let matchLine = solineLinkArray[m].linelink;
              log.debug({ title: "matchLine", details: matchLine });

              var solinelinkmatchline = currentRecord.findSublistLineWithValue({
                sublistId: "item",
                fieldId: "custcol_nco_so_linelink",
                value: matchLine,
              });
              log.debug({
                title: "solinelinkmatchline",
                details: solinelinkmatchline,
              });

              if (solinelinkmatchline !== -1) {
                log.debug({ title: "", details: "hereToSet" });
                // const getCostFieldTotal = currentRecord.getSublistValue({
                //   sublistId: "item",
                //   fieldId: "costestimate",
                //   line: solinelinkmatchline,
                // });
                // switch this to populate the cost estimate
                const setTotal = currentRecord.setSublistValue({
                  sublistId: "item",
                  fieldId: "costestimate",
                  line: solinelinkmatchline,
                  value: projectedtotal,
                });
              }
            }
          }
        }
      }
      if (poId.length) {
        // multiple PO records & multiple lines on the VB record
        for (p = 0; p < poId.length; p++) {
          const ponumber = poId[p].createdpo;
          log.debug("PO ID", ponumber);
          const solineLink = poId[p].custcol_nco_so_linelink;
          log.debug("solinelinkArray", solineLink);
          // find the line link number of the first item fulfillment line
          // function to get the item id
          const vbLineArray = getVBInfo(ponumber, solineLink) || 0;
          log.debug({ title: "vbLineArray", details: vbLineArray });
          const vbID = vbLineArray[p].nextdoc;
          log.debug({ title: "vbID", details: vbID });
          // vbLineItem could be define on the poId return
          const vbLineItem = vbLineArray[p].item;
          log.debug("VB Item", vbLineItem);
          // const getVBglcost = (vbid, item)
          const vbGLcostArray = getVBglcost(vbID, vbLineItem);
          log.debug({ title: "vbGLcostArray", vbGLcostArray });
          // how do I get this to cycle through its own loop
          let projectedtotal = 0;
          // need a way to loop through the lines from the VB record to place onto the invoice. If there are no returned values from the VBInfo (nothing posting), then it should skip this logic
          // what should happen here?!
          for (q = 0; q < vbLineArray.length; q++) {
            // projected total accounts for additional IF lines of the same SO line
            projectedtotal += vbGLcostArray[q].debit;
            log.debug("Projected Total", projectedtotal);
            let matchLine = vbLineArray[q].custcol_nco_so_linelink;
            log.debug({ title: "matchLine", details: matchLine });

            var solinelinkmatchline = currentRecord.findSublistLineWithValue({
              sublistId: "item",
              fieldId: "custcol_nco_so_linelink",
              value: matchLine,
            });
            log.debug({
              title: "solinelinkmatchline",
              details: solinelinkmatchline,
            });

            if (solinelinkmatchline !== -1) {
              log.debug({ title: "", details: "hereToSet in POiD section" });
              // const getCostFieldTotal = currentRecord.getSublistValue({
              //   sublistId: "item",
              //   fieldId: "costestimate",
              //   line: solinelinkmatchline,
              // });
              // switch this to populate the cost estimate
              const setTotal = currentRecord.setSublistValue({
                sublistId: "item",
                fieldId: "costestimate",
                line: solinelinkmatchline,
                value: projectedtotal,
              });
            }
          }
        }
      }
    } catch (e) {
      log.error(e.name, e.message);
    }
  };

  /**
   * Function definition to be triggered before record is loaded.
   *
   * @param {Object} scriptContext
   * @param {Record} scriptContext.newRecord - New record
   * @param {Record} scriptContext.oldRecord - Old record
   * @param {string} scriptContext.type - Trigger type
   * @Since 2015.2
   */
  const afterSubmit = (scriptContext) => {
    //   // this has to be changed so that the VB record is set
    const currentRecord = scriptContext.newRecord;
    log.debug("Current Record", currentRecord);

    const contextType = scriptContext.type;

    log.debug("type", contextType);
    const soid = currentRecord.getValue({
      fieldId: "createdfrom",
    });

    log.debug("SOiD", soid);

    const poInfo = getPOInfo(soid);
    log.debug({ title: "After Submit Test for POiD", details: poInfo });
    log.debug("Returned Array Length of createdPO", poInfo.length);
    if (!poInfo.length) return;
    // create a for loop to get all the VBs
    for (l = 0; l < poInfo.length; l++) {
      const poID = poInfo[l].createdpo;
      log.debug("vbID", poID);
      // const getVBInfo = (poid, linelink);
      const vbInfo = getVBInfo(poID, poInfo[l].custcol_nco_so_linelink);
      log.debug({ title: "vbInfo", details: vbInfo });
      // loop to get through all assembly builds on each work order
      for (m = 0; m < vbInfo.length; m++) {
        const vbID = vbInfo[m].nextdoc;
        const vbRecord = record.load({
          type: record.Type.VENDOR_BILL,
          id: vbID,
        });
        const approvalstatus = vbRecord.getValue("approvalstatus");
        log.debug("Approval Status", approvalstatus);
        if (approvalstatus == 2) {
          vbRecord.setValue({
            fieldId: "custbody_is_invoiced",
            value: true,
          });
        }

        // save the VB
        const vbRecordSaved = vbRecord.save({
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