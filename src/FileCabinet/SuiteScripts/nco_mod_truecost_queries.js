/**
 * @NApiVersion 2.1
 */
define(['N/query', 'N/record', 'N/search'],
    /**
 * @param{query} query
 * @param{record} record
 * @param{search} search
 */
    (query, record, search) => {

        /** 04.27.2023 getInputData is only used to source the tracking number. Debug is turned off */
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
            // log.debug("Sales Order Input Data", soid);
            // log.debug("Sales Order Data", confirmInfo);
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

        return {getInputData, getIFdata, getSOlinelink, getIFitem, getIFglcost, getPOInfo, getVBInfo, getVBglcost}

    });
