require 'rubygems'
require 'fech'
require 'json'
require 'rethinkdb'

include RethinkDB::Shortcuts

class Parse

  def initialize
    @temp_dir = File.join('.','temp')
    # @conn = r.connect(:host => 'localhost', :port => 28015, :db => 'fec_ef')
    @buffer = []
  end

  def get_id (file_name)
    file_name.sub('.fec','')
  end

  def slug (name)
    return name.gsub('/','_').gsub('\\','_')
  end

  def store (buffer)
    table_rows = {}
    buffer.each do |parsed_row|
      table_name = parsed_row.form_type
      if table_name == nil
        table_name = parsed_row.record_type
      end
      if table_name == nil
        table_name = parsed_row.rec_type
      end

      table_name = slug(table_name)

      if !table_rows.has_key?(table_name)
        table_rows[table_name] = []
      end
      table_rows[table_name].push(parsed_row)
    end

    table_rows.keys.each do |table_name|
      File.open("./parsed/#{table_name}.json", 'a') do |file|
        table_rows[table_name].each do |parsed_row|
          file.puts parsed_row.to_json + ','
        end
      end
    #  result = {}
    #  begin
    #    result = r.table(table_name).insert(table_rows[table_name]).run(@conn)
    #  rescue
    #    r.table_create(table_name).run(@conn)
    #    result = r.table(table_name).insert(table_rows[table_name]).run(@conn, :durability => 'soft', :return_vals => false)
    #  end
    #  if result['errors'] > 0
    #    puts 'Error: ' + result['first_error']
    #  end
    #  if table_rows[table_name].length != result['inserted']
    #    puts 'Should have inserted ' + table_rows[table_name].length + ', but inserted' + result['inserted']
    #  end
    end
  end

  def parse (file_name)
    id = get_id(file_name)

    filing = Fech::Filing.new(id,:download_dir => @temp_dir, :csv_parser => Fech::CsvDoctor)

    form_type = filing.form_type.gsub(/"/,'')

    if ['F24', 'F24A', 'F24N', 'F3X', 'F3XA', 'F3XN', 'F5', 'F5A', 'F5N','F9','F9A','F9N'].include? form_type

      # File.open("./parsed/summaries.json", 'a') do |file|
      #  file.puts filing.summary.to_json + ','
      # end

      buffer = []

      buffer.push(filing.summary)

      buffer.concat(filing.rows_like(/^se/))
      buffer.concat(filing.rows_like(/^hdr/))
      buffer.concat(filing.rows_like(/^f57/))
      buffer.concat(filing.rows_like(/^f93/))
      buffer.concat(filing.rows_like(/^f94/))

      buffer.each do |parsed_row|
        parsed_row['filing_number'] = id
        parsed_row['filing_type'] = form_type
      end

      store(buffer)

    end


    # if ['F99', '"F99"'].include? filing.form_type
    #   filing = Fech::Filing.new(id,:download_dir => @temp_dir)
    # end
    # filing.each_row_with_index do |row, index|
    #   next if ['F3Z','"F3Z"','F3ZT','"F3ZT"'].include? row.first
    #   parsed_row = filing.parse_row?(row)
    #   if parsed_row
    #    parsed_row['filing_id_number'] = id
    #    parsed_row['filing_row_index'] = index
    #    puts parsed_row.to_json
    #   end
    # end
  end

  def iterate
    Dir.foreach(@temp_dir) do |file|
      if file.include? '.fec'
        parse(file)
        puts file
      end
    end
    # @conn.close()
  end

end

parse = Parse.new
list = parse.iterate()
