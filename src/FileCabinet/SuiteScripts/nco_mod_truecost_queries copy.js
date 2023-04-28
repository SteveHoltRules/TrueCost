/**
 * 04.23.2023 This version will be used to clarify what is in the existing sql statements in production vs. what is in the sandbox environment.
 * @NApiVersion 2.1
 */
define(['N/query', 'N/record', 'N/search'],
    /**
 * @param{query} query
 * @param{record} record
 * @param{search} search
 */
    (query, record, search) => {

        /** 04.27.2023 getInputData is only used to source the tracking number - same for both versions of the script. Debug is turned off */
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

        /** Please holder to find out what is different between this statement and other version */
      
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
      
        /** 04.23.2023 This getIFdata should be more reliable because it inclues the linelink number */
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

        return {getInputData, getSoLineLink, getonlyIFs, getIFdata, getIFglcostSeq, getIFglcost}
        return {getInputData, getIFdata, getSOlinelink, getIFitem, getIFglcost, getPOInfo, getVBInfo, getVBglcost}

    });
