
const Table = require('cli-table3');

module.exports = (tableOptions, data)=>{
  var table = new Table(tableOptions);
  data.forEach(item=>table.push(item));
  console.log(table.toString());
}