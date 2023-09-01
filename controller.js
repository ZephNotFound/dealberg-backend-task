import db from './db.js';

async function queryFromDB(insertSql, queryArray) {
    let result;
    return new Promise((resolve, reject) => {
      db.query(insertSql, queryArray, (err, resp) => {
        if (err) throw err;
        result = resp;
        resolve(result);
      });
    }).then((response) => {
      return response;
    });
  }
  
  async function getData(email, phoneNumber) {
    let linkedPrimaryIds = [];
    let sql = "";
    let queryArray = [];
    if (email && phoneNumber) {
      sql =
        "SELECT * FROM Contacts WHERE linkPrecedence = ? AND (email = ? OR phoneNumber = ?) ORDER BY createdAt";
      queryArray = [...queryArray, email, phoneNumber];
    } else if (email) {
      sql =
        "SELECT * FROM Contacts WHERE linkPrecedence = ? AND email = ? ORDER BY createdAt";
      queryArray = [...queryArray, email];
    } else if (phoneNumber) {
      sql =
        "SELECT * FROM Contacts WHERE linkPrecedence = ? AND phoneNumber = ? ORDER BY createdAt";
      queryArray = [...queryArray, phoneNumber];
    }
  
    const primaryEntries = await queryFromDB(sql, ["primary", ...queryArray]);
    const secondaryEntries = await queryFromDB(sql, ["secondary", ...queryArray]);
    secondaryEntries.forEach((entry) => {
      if (entry.linkedId) {
        linkedPrimaryIds.push(entry.linkedId);
      }
    });
    if (linkedPrimaryIds.length === 0) {
      return {
        primaryEntries: primaryEntries,
        secondaryEntries: secondaryEntries,
        linkedPrimaryEntries: [],
      };
    }
  
    let newSql = `SELECT * FROM Contacts WHERE id IN (?) ORDER BY createdAt`;
    const linkedPrimaryEntries = await queryFromDB(newSql, linkedPrimaryIds);
    return {
      primaryEntries: primaryEntries,
      secondaryEntries: secondaryEntries,
      linkedPrimaryEntries: linkedPrimaryEntries,
    };
  }

  const getResponse = async(req, res) => {
    const { email, phoneNumber } = req.body;
  if (!email && !phoneNumber) {
    res.status(404).send("Atleast one of email or phoneNumber is required");
  }
  getData(email, phoneNumber).then(async (result) => {
    let { primaryEntries, secondaryEntries, linkedPrimaryEntries } = result;

    const emailList = [];
    const phoneList = [];
    const secondaryIdList = [];

    if (primaryEntries.length > 1 && secondaryEntries.length === 0) {
      let sql = `UPDATE Contacts SET linkPrecedence = ?, linkedId = ? WHERE id = ?`;
      let queryArray = [
        "secondary",
        primaryEntries[0].id,
        primaryEntries[1].id,
      ];
      const result = await queryFromDB(sql, queryArray);
      let emailList = [];
      let phoneList = [];
      primaryEntries.forEach((entry) => {
        if(entry.email) {
            emailList.push(entry.email);
        }
        if(entry.phoneNumber) {
            phoneList.push(entry.phoneNumber);
        }
      })
      const response = {
        contact: {
          primaryContactId:  primaryEntries[0].id,
          emails: emailList,
          phoneNumbers: phoneList,
          secondaryContactIds: [primaryEntries[1].id],
        },
      };
      res.json(response);
      return;
    }

    if (primaryEntries.length > 0 && secondaryEntries.length === 0) {
      let sql = `SELECT * FROM Contacts WHERE linkedId = ? ORDER BY createdAt ASC`;
      let queryArray = [primaryEntries[0].id];
      const result = await queryFromDB(sql, queryArray);
      if (result) {
        secondaryEntries = result;
      }
    }

    if (primaryEntries.length === 0 && linkedPrimaryEntries.length === 0) {
      let insertSql = `INSERT INTO Contacts(email,phoneNumber,linkPrecedence) VALUES(?,?,?)`;
      let queryArray = [email, phoneNumber, "primary"];
      const result = await queryFromDB(insertSql, queryArray);
      const response = {
        contact: {
          primaryContactId: result.insertId,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      };
      res.json(response);
      return;
    } else if (primaryEntries.length > 0 && email && phoneNumber) {
      const checkQuery =
        "SELECT * FROM Contacts WHERE linkPrecedence = ? AND (phoneNumber = ? OR email = ?) ORDER BY createdAt";
      const queryArray = ["secondary", phoneNumber, email];
      const result = await queryFromDB(checkQuery, queryArray);
      if (result.length === 0) {
        let insertSql = `INSERT INTO Contacts(email,phoneNumber,linkPrecedence,linkedId) VALUES(?,?,?,?)`;
        let queryArray = [
          email,
          phoneNumber,
          "secondary",
          primaryEntries[0].id,
        ];
        const InsertResult = await queryFromDB(insertSql, queryArray);

        let emailList = [];
        if (primaryEntries[0].email) {
          emailList.push(primaryEntries[0].email);
        }
        if (emailList.indexOf(email) == -1) emailList.push(email);

        let phoneList = [];
        if (primaryEntries[0].phoneNumber) {
          phoneList.push(primaryEntries[0].phoneNumber);
        }
        if (phoneList.indexOf(phoneNumber) == -1) phoneList.push(phoneNumber);

        const response = {
          contact: {
            primaryContactId: primaryEntries[0].id,
            emails: emailList,
            phoneNumbers: phoneList,
            secondaryContactIds: [InsertResult.insertId],
          },
        };
        res.json(response);
        return;
      }
    }

    primaryEntries.forEach((entry) => {
      if (entry.email && emailList.indexOf(entry.email) == -1)
        emailList.push(entry.email);
      if (entry.phoneNumber && phoneList.indexOf(entry.phoneNumber) == -1)
        phoneList.push(entry.phoneNumber);
    });

    secondaryEntries.forEach((entry) => {
      if (entry.email && emailList.indexOf(entry.email) == -1)
        emailList.push(entry.email);
      if (entry.phoneNumber && phoneList.indexOf(entry.phoneNumber) == -1)
        phoneList.push(entry.phoneNumber);
      if (entry.id && secondaryIdList.indexOf(entry.id) == -1)
        secondaryIdList.push(entry.id);
    });

    linkedPrimaryEntries.forEach((entry) => {
      if (entry.email && emailList.indexOf(entry.email) == -1)
        emailList.push(entry.email);
      if (entry.phoneNumber && phoneList.indexOf(entry.phoneNumber) == -1)
        phoneList.push(entry.phoneNumber);
    });

    const response = {
      contact: {
        primaryContactId:
          primaryEntries[0]?.id || linkedPrimaryEntries[0]?.id || null,
        emails: emailList,
        phoneNumbers: phoneList,
        secondaryContactIds: secondaryIdList,
      },
    };
    res.json(response);
  });
  }

  export { getResponse };