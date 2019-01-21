const express = require('express');
const bodyParser = require('body-parser');
const mysql      = require('mysql');
var cors = require('cors');
const Perf = require('performance-node');
const apicache = require('apicache');

const timeline = new Perf();
// https://github.com/mysqljs/mysql
const connection = mysql.createConnection({
  host     : 'db4free.net',
  user     : 'raphaelinha',
  password : 'raphael1234',
  database : 'sacase_inha'
});

const concat = (x,y) =>
  x.concat(y)

const flatMap = (f,xs) =>
  xs.map(f).reduce(concat, [])

function toTitleCase(str) {
    return str.replace(
        /[\wàèìòùÀÈÌÒÙáéíóúýÁÉÍÓÚÝâêîôûÂÊÎÔÛãñõÃÑÕäëïöüÿÄËÏÖÜŸçÇßØøÅåÆæœ]\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}
// Maybe look into pooling
connection.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

// Initialize the app
const app = express();
app.use(cors())
const cache = apicache.middleware


// https://expressjs.com/en/guide/routing.html
app.get('/actors', cache('5 minutes'), function (req, res) {
    var query = 'select first_name, last_name, role from actor order by last_name, first_name, role;'
    if (typeof req.query.role !== 'undefined') {
        query = 'select first_name, last_name, role from actor where role = "' + req.query.role + '" order by last_name, first_name, role;'
    }
    connection.query(query, function (error, results, fields) {
        if (error) {
            console.log(error)
            results = []
        }
                
        res.setHeader('Content-Type', 'application/json');
        res.send(results)
    });

});

app.get('/section', cache('5 minutes'), function(req, res) {
    var query = `select UCASE(word) as text, count(*) as value from section_word_count`

    if (typeof req.query.class !== 'undefined') {
        query += `
        where (section_sale_id, section_page, section_entity) IN
        (SELECT sale_id, page, entity from section
        where class="${req.query.class}")
        `
    }


    if (typeof req.query.actor !== 'undefined') {
        if (typeof req.query.class !== 'undefined') {
            query += ' and '
        } else {
            query += ' where '
        }
        [first_name, last_name, role] = req.query.actor.split('_')
        if (typeof first_name !== 'undefined' && typeof last_name !== 'undefined' && typeof role !== 'undefined') {
            query += `section_sale_id IN
            (SELECT actor_sale.sale_id FROM actor_sale
                WHERE actor_sale.actor_id =
                    (SELECT actor_id FROM actor
                        WHERE actor.first_name = "${first_name}" and
                              actor.last_name = "${last_name}" and
                              actor.role = "${role}"  LIMIT 1))
                              `
        }
    }

    if (typeof req.query.startdate !== 'undefined') {
        if (typeof req.query.class !== 'undefined' || typeof req.query.actor !== 'undefined') {
            query += ' and '
        } else {
            query += ' where '
        }
        query += `section_sale_id IN
        (select sale.sale_id
         from sale
         where sale.date >= '${req.query.startdate}')
        `
    }
    if (typeof req.query.enddate !== 'undefined') {
        if (typeof req.query.class !== 'undefined' || typeof req.query.actor !== 'undefined' || typeof req.query.startdate !== 'undefined') {
            query += ' and '
        } else {
            query += ' where '
        }
        query += `section_sale_id IN
        (select sale.sale_id
         from sale
         where sale.date <= '${req.query.enddate}')`
    }
    query += `
    group by UCASE(word)
    order by count(*) desc`
    if (typeof req.query.limit !== 'undefined' &&  !isNaN(parseInt(req.query.limit))) {
        query += `
        LIMIT ` + req.query.limit
    }
    query += ';'
    console.log(query)
    connection.query(query, function(error, rows, fields) {
        if (error) {
            console.log(error)
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify([]))
            return
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(rows.filter(word => word.text.length > 2))
    })
})
// Start the server
app.listen(8080, '0.0.0.0', () => {
 console.log('Go to http://localhost:8080');
});